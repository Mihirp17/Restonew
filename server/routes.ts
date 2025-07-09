import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from 'express-session';
import { sessionConfig, authenticate, authorize, authorizeRestaurant, loginPlatformAdmin, loginRestaurant, loginUser } from "./auth";
import { setupWebSocketServer } from "./socket";
import { z } from "zod";
import { insertRestaurantSchema, insertUserSchema, insertMenuItemSchema, insertTableSchema, insertOrderSchema, insertOrderItemSchema, insertFeedbackSchema } from "@shared/schema";
// Stripe functionality removed - import { stripe, createOrUpdateCustomer, createSubscription, updateSubscription, cancelSubscription, generateClientSecret, handleWebhookEvent, PLANS } from "./stripe";
import QRCode from 'qrcode';

// Schema for login requests
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Schema for date range
const dateRangeSchema = z.object({
  startDate: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s))
});

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("Starting route registration...");
  
  // Set up session
  console.log("Setting up session middleware...");
  app.use(session(sessionConfig));
  console.log("Session middleware set up successfully");
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
  });

  // Authentication Routes
  console.log("Setting up authentication routes...");
  app.post('/api/auth/login', async (req, res) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { email, password } = validation.data;
      let user = null;

      // Try to login as platform admin
      user = await loginPlatformAdmin(email, password);
      
      // If not admin, try restaurant
      if (!user) {
        user = await loginRestaurant(email, password);
      }
      
      // If not restaurant, try regular user
      if (!user) {
        user = await loginUser(email, password);
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Set user in session
      req.session.user = user;
      return res.json({ user });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'An error occurred during login' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.clearCookie('connect.sid');
      return res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
      return res.json({ user: req.session.user });
    }
    return res.status(401).json({ message: 'Not authenticated' });
  });
  console.log("Authentication routes set up successfully");

  // Restaurant Routes
  console.log("Setting up restaurant routes...");
  app.get('/api/restaurants', authenticate, authorize(['platform_admin']), async (req, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      return res.json(restaurants);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      return res.status(500).json({ message: 'Failed to fetch restaurants' });
    }
  });

  app.post('/api/restaurants', authenticate, authorize(['platform_admin']), async (req, res) => {
    try {
      const validation = insertRestaurantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const restaurant = await storage.createRestaurant(validation.data);
      return res.status(201).json(restaurant);
    } catch (error) {
      console.error('Error creating restaurant:', error);
      return res.status(500).json({ message: 'Failed to create restaurant' });
    }
  });

  app.get('/api/restaurants/:restaurantId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      return res.json(restaurant);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      return res.status(500).json({ message: 'Failed to fetch restaurant' });
    }
  });

  app.put('/api/restaurants/:restaurantId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertRestaurantSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedRestaurant = await storage.updateRestaurant(restaurantId, validation.data);
      if (!updatedRestaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      return res.json(updatedRestaurant);
    } catch (error) {
      console.error('Error updating restaurant:', error);
      return res.status(500).json({ message: 'Failed to update restaurant' });
    }
  });
  console.log("Restaurant routes set up successfully");

  // Table Routes
  console.log("Setting up table routes...");
  app.get('/api/restaurants/:restaurantId/tables', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const tables = await storage.getTablesByRestaurantId(restaurantId);
      return res.json(tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
      return res.status(500).json({ message: 'Failed to fetch tables' });
    }
  });

  app.post('/api/restaurants/:restaurantId/tables', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Generate QR code
      const tableNumber = req.body.number;
      const baseUrl = req.protocol + '://' + req.get('host');
      const qrUrl = `${baseUrl}/menu/${restaurantId}/${tableNumber}`;
      const qrCode = await QRCode.toDataURL(qrUrl);

      const validation = insertTableSchema.safeParse({
        ...req.body,
        restaurantId,
        qrCode
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const table = await storage.createTable(validation.data);
      return res.status(201).json(table);
    } catch (error) {
      console.error('Error creating table:', error);
      return res.status(500).json({ message: 'Failed to create table' });
    }
  });

  app.put('/api/restaurants/:restaurantId/tables/:tableId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableId = parseInt(req.params.tableId);
      
      if (isNaN(restaurantId) || isNaN(tableId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertTableSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedTable = await storage.updateTable(tableId, validation.data);
      if (!updatedTable) {
        return res.status(404).json({ message: 'Table not found' });
      }

      return res.json(updatedTable);
    } catch (error) {
      console.error('Error updating table:', error);
      return res.status(500).json({ message: 'Failed to update table' });
    }
  });

  app.delete('/api/restaurants/:restaurantId/tables/:tableId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableId = parseInt(req.params.tableId);
      
      if (isNaN(restaurantId) || isNaN(tableId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const deleted = await storage.deleteTable(tableId);
      if (!deleted) {
        return res.status(404).json({ message: 'Table not found' });
      }

      return res.json({ message: 'Table deleted successfully' });
    } catch (error) {
      console.error('Error deleting table:', error);
      return res.status(500).json({ message: 'Failed to delete table' });
    }
  });
  console.log("Table routes set up successfully");

  // Table Session Routes
  console.log("Setting up table session routes...");
  app.get('/api/restaurants/:restaurantId/table-sessions', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const status = req.query.status as string;
      const tableSessions = await storage.getTableSessionsByRestaurantId(restaurantId, status);
      return res.json(tableSessions);
    } catch (error) {
      console.error('Error fetching table sessions:', error);
      return res.status(500).json({ message: 'Failed to fetch table sessions' });
    }
  });

  app.get('/api/restaurants/:restaurantId/table-sessions/:sessionId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const tableSession = await storage.getTableSession(sessionId);
      if (!tableSession) {
        return res.status(404).json({ message: 'Table session not found' });
      }

      return res.json(tableSession);
    } catch (error) {
      console.error('Error fetching table session:', error);
      return res.status(500).json({ message: 'Failed to fetch table session' });
    }
  });

  app.post('/api/restaurants/:restaurantId/table-sessions', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const tableSession = await storage.createTableSession({
        ...req.body,
        restaurantId
      });
      return res.status(201).json(tableSession);
    } catch (error) {
      console.error('Error creating table session:', error);
      return res.status(500).json({ message: 'Failed to create table session' });
    }
  });

  app.put('/api/restaurants/:restaurantId/table-sessions/:sessionId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const updatedSession = await storage.updateTableSession(sessionId, req.body);
      if (!updatedSession) {
        return res.status(404).json({ message: 'Table session not found' });
      }

      return res.json(updatedSession);
    } catch (error) {
      console.error('Error updating table session:', error);
      return res.status(500).json({ message: 'Failed to update table session' });
    }
  });

  // Customer Routes
  app.post('/api/restaurants/:restaurantId/customers', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const customer = await storage.createCustomer(req.body);
      return res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      return res.status(500).json({ message: 'Failed to create customer' });
    }
  });

  // Bill Routes
  app.get('/api/restaurants/:restaurantId/table-sessions/:sessionId/bills', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const bills = await storage.getBillsByTableSessionId(sessionId);
      return res.json(bills);
    } catch (error) {
      console.error('Error fetching bills:', error);
      return res.status(500).json({ message: 'Failed to fetch bills' });
    }
  });

  app.post('/api/restaurants/:restaurantId/table-sessions/:sessionId/bills', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const bill = await storage.createBill({
        ...req.body,
        tableSessionId: sessionId
      });
      return res.status(201).json(bill);
    } catch (error) {
      console.error('Error creating bill:', error);
      return res.status(500).json({ message: 'Failed to create bill' });
    }
  });

  app.put('/api/restaurants/:restaurantId/bills/:billId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const billId = parseInt(req.params.billId);
      
      if (isNaN(restaurantId) || isNaN(billId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const updatedBill = await storage.updateBill(billId, req.body);
      if (!updatedBill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      return res.json(updatedBill);
    } catch (error) {
      console.error('Error updating bill:', error);
      return res.status(500).json({ message: 'Failed to update bill' });
    }
  });
  console.log("Table session and bill routes set up successfully");

  // Aggregated Bills Route - fetch all bills for a restaurant (optionally by status)
  app.get('/api/restaurants/:restaurantId/bills', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const status = req.query.status as string | undefined;
      const bills = await storage.getBillsByRestaurantId(restaurantId, status);
      return res.json(bills);
    } catch (error) {
      console.error('Error fetching bills:', error);
      return res.status(500).json({ message: 'Failed to fetch bills' });
    }
  });

  // Menu Item Routes
  console.log("Setting up menu item routes...");
  app.get('/api/restaurants/:restaurantId/menu-items', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const menuItems = await storage.getMenuItems(restaurantId);
      return res.json(menuItems);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      return res.status(500).json({ message: 'Failed to fetch menu items' });
    }
  });

  app.post('/api/restaurants/:restaurantId/menu-items', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = insertMenuItemSchema.safeParse({
        ...req.body,
        restaurantId
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const menuItem = await storage.createMenuItem(validation.data);
      return res.status(201).json(menuItem);
    } catch (error) {
      console.error('Error creating menu item:', error);
      return res.status(500).json({ message: 'Failed to create menu item' });
    }
  });

  app.put('/api/restaurants/:restaurantId/menu-items/:menuItemId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const menuItemId = parseInt(req.params.menuItemId);
      
      if (isNaN(restaurantId) || isNaN(menuItemId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertMenuItemSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedMenuItem = await storage.updateMenuItem(menuItemId, validation.data);
      if (!updatedMenuItem) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      return res.json(updatedMenuItem);
    } catch (error) {
      console.error('Error updating menu item:', error);
      return res.status(500).json({ message: 'Failed to update menu item' });
    }
  });

  app.delete('/api/restaurants/:restaurantId/menu-items/:menuItemId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const menuItemId = parseInt(req.params.menuItemId);
      
      if (isNaN(restaurantId) || isNaN(menuItemId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      const deleted = await storage.deleteMenuItem(menuItemId);
      if (!deleted) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      return res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return res.status(500).json({ message: 'Failed to delete menu item' });
    }
  });
  console.log("Menu item routes set up successfully");

  // Order Routes
  console.log("Setting up order routes...");
  app.get('/api/restaurants/:restaurantId/orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const orders = await storage.getOrdersByRestaurantId(restaurantId);
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItemsByOrderId(order.id);
          return { ...order, items };
        })
      );

      return res.json(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/restaurants/:restaurantId/active-orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20; // Default to 20 orders max
      const orders = await storage.getActiveOrdersByRestaurantId(restaurantId, limit);
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItemsByOrderId(order.id);
          return { ...order, items };
        })
      );

      return res.json(ordersWithItems);
    } catch (error) {
      console.error('Error fetching active orders:', error);
      return res.status(500).json({ message: 'Failed to fetch active orders' });
    }
  });

  // Lightweight active orders endpoint for dashboard (faster loading)
  app.get('/api/restaurants/:restaurantId/active-orders-lightweight', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10; // Default to 10 for dashboard
      const orders = await storage.getActiveOrdersLightweight(restaurantId, limit);

      return res.json(orders);
    } catch (error) {
      console.error('Error fetching lightweight active orders:', error);
      return res.status(500).json({ message: 'Failed to fetch lightweight active orders' });
    }
  });

  // Thin active orders endpoint (minimal payload)
  app.get('/api/restaurants/:restaurantId/active-orders/thin', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 15;
      const orders = await storage.getActiveOrdersThin(restaurantId, limit);
      return res.json(orders);
    } catch (error) {
      console.error('Error fetching thin active orders:', error);
      return res.status(500).json({ message: 'Failed to fetch active orders' });
    }
  });

  app.post('/api/restaurants/:restaurantId/orders', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate order data
      const validation = insertOrderSchema.safeParse({
        ...req.body,
        restaurantId
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      // Validate that table exists and belongs to the restaurant
      const table = await storage.getTable(req.body.tableId);
      if (!table) {
        return res.status(400).json({ message: 'Table not found' });
      }
      if (table.restaurantId !== restaurantId) {
        return res.status(400).json({ message: 'Table does not belong to this restaurant' });
      }

      // Create the order
      const order = await storage.createOrder(validation.data);

      // Create order items
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          await storage.createOrderItem({
            quantity: item.quantity,
            price: item.price,
            orderId: order.id,
            menuItemId: item.menuItemId
          });
        }
      }

      // Get the complete order with items
      const items = await storage.getOrderItemsByOrderId(order.id);
      
      // Fetch menu item details for each order item
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          const menuItem = await storage.getMenuItem(item.menuItemId);
          return {
            ...item,
            menuItem
          };
        })
      );
      
      const completeOrder = { ...order, items: itemsWithDetails };
      
      // Send real-time notification to restaurant
      const { WebSocket } = await import('ws');
      const clients = (global as any).wsClients || [];
      
      // Send to all restaurant staff clients
      clients.forEach((client: any) => {
        if (
          client.restaurantId === restaurantId && 
          client.socket.readyState === WebSocket.OPEN
        ) {
          client.socket.send(JSON.stringify({
            type: 'new-order-received',
            payload: completeOrder
          }));
        }
      });

      return res.status(201).json(completeOrder);
    } catch (error) {
      console.error('Error creating order:', error);
      return res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.put('/api/restaurants/:restaurantId/orders/:orderId', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const orderId = parseInt(req.params.orderId);
      
      if (isNaN(restaurantId) || isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }

      // Validate only the fields that are provided
      const updateSchema = insertOrderSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const updatedOrder = await storage.updateOrder(orderId, validation.data);
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Get the updated order with items
      const items = await storage.getOrderItemsByOrderId(orderId);
      const completeOrder = { ...updatedOrder, items };

      return res.json(completeOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      return res.status(500).json({ message: 'Failed to update order' });
    }
  });
  console.log("Order routes set up successfully");

  // Analytics Routes
  console.log("Setting up analytics routes...");
  
  // Combined dashboard analytics endpoint for better performance
  app.post('/api/restaurants/:restaurantId/analytics/dashboard', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      
      // Fetch all analytics data in parallel for better performance
      const [revenue, orderCount, averageOrderValue, tables] = await Promise.all([
        storage.getRestaurantRevenue(restaurantId, startDate, endDate),
        storage.getOrderCountByRestaurantId(restaurantId, startDate, endDate),
        storage.getAverageOrderValue(restaurantId, startDate, endDate),
        storage.getTablesByRestaurantId(restaurantId)
      ]);

      return res.json({
        revenue,
        orderCount,
        averageOrderValue,
        activeTables: tables.filter(table => table.isOccupied).length,
        totalTables: tables.length
      });
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      return res.status(500).json({ message: 'Failed to fetch dashboard analytics' });
    }
  });

  app.post('/api/restaurants/:restaurantId/analytics/revenue', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const revenue = await storage.getRestaurantRevenue(restaurantId, startDate, endDate);
      return res.json({ revenue });
    } catch (error) {
      console.error('Error fetching revenue:', error);
      return res.status(500).json({ message: 'Failed to fetch revenue' });
    }
  });

  app.post('/api/restaurants/:restaurantId/analytics/orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const orderCount = await storage.getOrderCountByRestaurantId(restaurantId, startDate, endDate);
      return res.json({ orderCount });
    } catch (error) {
      console.error('Error fetching order count:', error);
      return res.status(500).json({ message: 'Failed to fetch order count' });
    }
  });

  app.post('/api/restaurants/:restaurantId/analytics/average-order', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const averageOrderValue = await storage.getAverageOrderValue(restaurantId, startDate, endDate);
      return res.json({ averageOrderValue });
    } catch (error) {
      console.error('Error fetching average order value:', error);
      return res.status(500).json({ message: 'Failed to fetch average order value' });
    }
  });

  app.get('/api/restaurants/:restaurantId/analytics/popular-items', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const popularItems = await storage.getPopularMenuItems(restaurantId, limit);
      return res.json(popularItems);
    } catch (error) {
      console.error('Error fetching popular items:', error);
      return res.status(500).json({ message: 'Failed to fetch popular items' });
    }
  });
  console.log("Analytics routes set up successfully");

  // AI Routes
  console.log("Setting up AI routes...");
  
  // AI Insights endpoints
  app.get('/api/restaurants/:restaurantId/ai-insights', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const insights = await storage.getAiInsightsByRestaurantId(restaurantId);
      return res.json(insights);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      return res.status(500).json({ message: 'Failed to fetch AI insights' });
    }
  });

  app.post('/api/restaurants/:restaurantId/ai-insights/generate', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const { generateRestaurantInsights } = await import('./ai.js');
      const insights = await generateRestaurantInsights(restaurantId);
      return res.json(insights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return res.status(500).json({ message: 'Failed to generate AI insights' });
    }
  });

  app.put('/api/restaurants/:restaurantId/ai-insights/:insightId/read', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const insightId = parseInt(req.params.insightId);
      
      if (isNaN(restaurantId) || isNaN(insightId)) {
        return res.status(400).json({ message: 'Invalid restaurant or insight ID' });
      }

      const success = await storage.markAiInsightAsRead(insightId);
      if (!success) {
        return res.status(404).json({ message: 'Insight not found' });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error marking insight as read:', error);
      return res.status(500).json({ message: 'Failed to mark insight as read' });
    }
  });

  app.put('/api/restaurants/:restaurantId/ai-insights/:insightId/status', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const insightId = parseInt(req.params.insightId);
      const { status } = req.body;
      
      if (isNaN(restaurantId) || isNaN(insightId)) {
        return res.status(400).json({ message: 'Invalid restaurant or insight ID' });
      }

      if (!['pending', 'in_progress', 'completed', 'dismissed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const success = await storage.updateAiInsightStatus(insightId, status);
      if (!success) {
        return res.status(404).json({ message: 'Insight not found' });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error updating insight status:', error);
      return res.status(500).json({ message: 'Failed to update insight status' });
    }
  });

  // AI Chat endpoint
  app.post('/api/restaurants/:restaurantId/ai/chat', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const { message, timeframe, dataTypes } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'Message is required' });
      }

      const { handleRestaurantChat } = await import('./ai.js');
      const response = await handleRestaurantChat({
        message,
        context: {
          restaurantId,
          timeframe: timeframe || '30_days',
          dataTypes: dataTypes || ['orders', 'revenue', 'feedback', 'menu_items']
        }
      });

      return res.json({ response });
    } catch (error) {
      console.error('Error processing AI chat:', error);
      return res.status(500).json({ message: 'Failed to process chat message' });
    }
  });

  // AI Analytics Insights endpoint
  app.post('/api/restaurants/:restaurantId/analytics/ai-insights', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;

      // Get restaurant data for the specified date range
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      // Get data for the date range
      const [orders, menuItems, feedback] = await Promise.all([
        storage.getOrdersByRestaurantId(restaurantId),
        storage.getMenuItems(restaurantId),
        storage.getFeedbackByRestaurantId(restaurantId)
      ]);

      // Filter data by date range
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      });

      const filteredFeedback = feedback.filter(f => {
        const feedbackDate = new Date(f.createdAt);
        return feedbackDate >= startDate && feedbackDate <= endDate;
      });

      // Calculate metrics
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
      const averageOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
      const averageRating = filteredFeedback.length > 0 ? filteredFeedback.reduce((sum, f) => sum + f.rating, 0) / filteredFeedback.length : 0;

      // Generate insights using AI
      const { generateRestaurantInsights } = await import('./ai.js');
      const insights = await generateRestaurantInsights(restaurantId);

      // Format response for analytics tab
      const performanceSummary = `Your restaurant generated $${totalRevenue.toFixed(2)} in revenue from ${filteredOrders.length} orders during this period. The average order value was $${averageOrderValue.toFixed(2)}.`;
      
      const recommendations = insights.slice(0, 3).flatMap(insight => insight.recommendations);
      
      const popularItemsAnalysis = `Your top performing items are generating consistent revenue. Consider promoting high-margin items to increase profitability.`;
      
      const customerSatisfaction = `Customer satisfaction is at ${averageRating.toFixed(1)}/5 based on ${filteredFeedback.length} reviews. Focus on addressing any negative feedback to improve ratings.`;
      
      const growthOpportunities = [
        'Implement a loyalty program to increase customer retention',
        'Optimize menu pricing based on cost analysis',
        'Consider expanding delivery options during peak hours'
      ];

      return res.json({
        performanceSummary,
        recommendations,
        popularItemsAnalysis,
        customerSatisfaction,
        growthOpportunities
      });
    } catch (error) {
      console.error('Error generating analytics insights:', error);
      return res.status(500).json({ message: 'Failed to generate analytics insights' });
    }
  });

  console.log("AI routes set up successfully");

  // Feedback Routes
  console.log("Setting up feedback routes...");
  app.post('/api/restaurants/:restaurantId/feedback', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const validation = insertFeedbackSchema.safeParse({
        ...req.body,
        restaurantId
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const feedback = await storage.createFeedback(validation.data);
      return res.status(201).json(feedback);
    } catch (error) {
      console.error('Error creating feedback:', error);
      return res.status(500).json({ message: 'Failed to create feedback' });
    }
  });

  app.get('/api/restaurants/:restaurantId/feedback', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const feedbackList = await storage.getFeedbackByRestaurantId(restaurantId);
      return res.json(feedbackList);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return res.status(500).json({ message: 'Failed to fetch feedback' });
    }
  });
  console.log("Feedback routes set up successfully");

  // Subscription Routes (Stripe functionality disabled)
  console.log("Setting up subscription routes...");
  app.post('/api/restaurants/:restaurantId/subscription', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Stripe functionality removed - returning basic subscription
      return res.json({
        subscriptionId: `sub_${restaurantId}_basic`,
        clientSecret: 'payment_disabled',
        message: 'Subscription service temporarily disabled'
      });
    } catch (error) {
      console.error('Error creating subscription:', error);
      return res.status(500).json({ message: 'Failed to create subscription' });
    }
  });

  app.put('/api/restaurants/:restaurantId/subscription', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Stripe functionality disabled - return placeholder response
      return res.json({
        subscriptionId: `sub_${restaurantId}_updated`,
        status: 'active',
        message: 'Subscription service temporarily disabled'
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      return res.status(500).json({ message: 'Failed to update subscription' });
    }
  });

  app.delete('/api/restaurants/:restaurantId/subscription', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Stripe functionality disabled - return placeholder response
      return res.json({
        status: 'canceled',
        message: 'Subscription service temporarily disabled'
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return res.status(500).json({ message: 'Failed to cancel subscription' });
    }
  });
  console.log("Subscription routes set up successfully");

  // Stripe webhook handler (disabled)
  console.log("Setting up Stripe webhook handler...");
  app.post('/api/webhooks/stripe', async (req, res) => {
    // Stripe functionality disabled - return placeholder response
    res.json({ 
      received: true, 
      message: 'Stripe webhook service temporarily disabled' 
    });
  });
  console.log("Stripe webhook handler set up successfully");

  // Create HTTP server
  console.log("Creating HTTP server...");
  const httpServer = createServer(app);
  console.log("HTTP server created successfully");
  
  // Set up WebSockets
  console.log("Setting up WebSocket server...");
  setupWebSocketServer(httpServer);
  console.log("WebSocket server set up successfully");

  console.log("Route registration completed successfully");
  return httpServer;
}
