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
import { generateRestaurantInsights, handleRestaurantChat, generateAnalyticsInsights } from './ai';
import { OrderItem, Order } from "@shared/schema";

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

  // Public restaurant endpoint for customer menu
  app.get('/api/public/restaurants/:restaurantId', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      // Return only public restaurant data
      return res.json({
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description,
        logo: restaurant.logo
      });
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      return res.status(500).json({ message: 'Failed to fetch restaurant' });
    }
  });

  // Public table sessions endpoint for customer menu
  app.get('/api/public/restaurants/:restaurantId/table-sessions', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableId = req.query.tableId ? parseInt(req.query.tableId as string) : undefined;
      
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      if (tableId && isNaN(tableId)) {
        return res.status(400).json({ message: 'Invalid table ID' });
      }

      // Get table sessions for the restaurant
      const sessions = await storage.getTableSessionsByRestaurantId(restaurantId);
      
      // Filter by table ID if provided
      const filteredSessions = tableId 
        ? sessions.filter(session => session.tableId === tableId)
        : sessions;

      return res.json(filteredSessions);
    } catch (error) {
      console.error('Error fetching table sessions:', error);
      return res.status(500).json({ message: 'Failed to fetch table sessions' });
    }
  });

  // Public create table session endpoint for customer menu
  app.post('/api/public/restaurants/:restaurantId/table-sessions', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const { tableId, partySize, status } = req.body;
      
      if (!tableId || isNaN(parseInt(tableId))) {
        return res.status(400).json({ message: 'Valid table ID is required' });
      }

      const session = await storage.createTableSession({
        restaurantId,
        tableId: parseInt(tableId),
        partySize: partySize || 1,
        status: status || 'active',
        sessionName: null,
        splitType: 'individual'
      });

      return res.status(201).json(session);
    } catch (error) {
      console.error('Error creating table session:', error);
      return res.status(500).json({ message: 'Failed to create table session' });
    }
  });

  // Public customers endpoint for customer menu
  app.post('/api/public/restaurants/:restaurantId/customers', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const { name, email, phone, tableSessionId, isMainCustomer } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Customer name is required' });
      }

      if (!tableSessionId || isNaN(parseInt(tableSessionId))) {
        return res.status(400).json({ message: 'Valid table session ID is required' });
      }

      const customer = await storage.createCustomer({
        tableSessionId: parseInt(tableSessionId),
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        isMainCustomer: isMainCustomer || false
      });

      return res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      return res.status(500).json({ message: 'Failed to create customer' });
    }
  });

  // Public get customers for table session endpoint
  app.get('/api/public/restaurants/:restaurantId/table-sessions/:sessionId/customers', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      const customers = await storage.getCustomersByTableSessionId(sessionId);
      return res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      return res.status(500).json({ message: 'Failed to fetch customers' });
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

  // Menu Analytics Endpoint for AI Insights
  app.get('/api/restaurants/:restaurantId/analytics/menu', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'day';
      
      // Calculate date range based on timeframe
      const now = new Date();
      let startDate: Date;
      
      switch (timeframe) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Get menu items with analytics
      const menuItems = await storage.getMenuItems(restaurantId);
      const orders = await storage.getOrdersByRestaurantId(restaurantId);
      
      // Filter orders by timeframe
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= now;
      });

      // Get order items for filtered orders
      const orderItemsPromises = filteredOrders.map(order => storage.getOrderItemsByOrderId(order.id));
      const orderItemsArrays = await Promise.all(orderItemsPromises);
      const orderItems = orderItemsArrays.flat();

      // Calculate analytics for each menu item
      const menuAnalyticsPromises = menuItems.map(async (item) => {
        const itemOrders = orderItems.filter(orderItem => orderItem.menuItemId === item.id);
        const count = itemOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        const revenue = itemOrders.reduce((sum: number, orderItem) => sum + (parseFloat(orderItem.price) * orderItem.quantity), 0);
        
        // Calculate growth (simplified - compare with previous period)
        const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
        const previousOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= previousStartDate && orderDate < startDate;
        });
        const previousOrderItemsPromises = previousOrders.map(order => storage.getOrderItemsByOrderId(order.id));
        const previousOrderItemsArrays = await Promise.all(previousOrderItemsPromises);
        const previousOrderItems = previousOrderItemsArrays.flat();
        const previousItemOrders = previousOrderItems.filter(orderItem => orderItem.menuItemId === item.id);
        const previousCount = previousItemOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        
        const growth = previousCount > 0 ? ((count - previousCount) / previousCount) * 100 : 0;
        
        return {
          id: item.id,
          name: item.name,
          count,
          revenue,
          category: item.category || 'Uncategorized',
          trend: growth > 5 ? 'up' : growth < -5 ? 'down' : 'stable',
          growth: Math.round(growth * 100) / 100
        };
      });
      
      const menuAnalytics = await Promise.all(menuAnalyticsPromises);

      // Sort by count to get top and low selling items
      const sortedItems = menuAnalytics.sort((a, b) => b.count - a.count);
      const topSelling = sortedItems.slice(0, 5);
      const lowSelling = sortedItems.slice(-5).reverse();

      // Calculate category breakdown
      const categoryMap = new Map<string, { count: number; revenue: number }>();
      menuAnalytics.forEach(item => {
        const category = item.category;
        const existing = categoryMap.get(category) || { count: 0, revenue: 0 };
        categoryMap.set(category, {
          count: existing.count + item.count,
          revenue: existing.revenue + item.revenue
        });
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        revenue: data.revenue
      }));

      // Generate AI recommendations
      const recommendations: Array<{
        item: string;
        action: 'promote' | 'remove' | 'adjust_price';
        reason: string;
      }> = [];
      
      // Recommend promoting top performers
      topSelling.slice(0, 2).forEach(item => {
        if (item.growth > 10) {
          recommendations.push({
            item: item.name,
            action: 'promote',
            reason: `High performer with ${item.growth}% growth. Consider featuring this item prominently.`
          });
        }
      });

      // Recommend removing or adjusting low performers
      lowSelling.slice(0, 2).forEach(item => {
        if (item.count === 0) {
          recommendations.push({
            item: item.name,
            action: 'remove',
            reason: 'No orders in this period. Consider removing from menu or adjusting pricing.'
          });
        } else if (item.growth < -20) {
          recommendations.push({
            item: item.name,
            action: 'adjust_price',
            reason: `Declining performance (${item.growth}% growth). Consider price adjustment or promotion.`
          });
        }
      });

      return res.json({
        topSelling,
        lowSelling,
        categoryBreakdown,
        recommendations
      });
    } catch (error) {
      console.error('Error fetching menu analytics:', error);
      return res.status(500).json({ message: 'Failed to fetch menu analytics' });
    }
  });

  // Demand Prediction Endpoint for AI Insights
  app.get('/api/restaurants/:restaurantId/analytics/demand-prediction', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'day';
      const now = new Date();
      let startDate: Date;
      switch (timeframe) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Get menu items
      const menuItems = await storage.getMenuItems(restaurantId);
      
      // Get orders for the selected timeframe
      const orders = await storage.getOrdersByRestaurantId(restaurantId);
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= now;
      });

      // Get order items for filtered orders
      const orderItems = await Promise.all(
        filteredOrders.map(order => storage.getOrderItemsByOrderId(order.id))
      );

      // Generate demand predictions for each menu item
      const demandPredictions = menuItems.slice(0, 6).map(item => {
        const itemOrders = orderItems.flat().filter(orderItem => orderItem.menuItemId === item.id);
        const totalQuantity = itemOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        
        // Simple prediction based on historical data
        const avgDailyDemand = totalQuantity / 30;
        const predictedDemand = Math.round(avgDailyDemand * 1.1); // 10% growth assumption
        
        // Calculate confidence based on data consistency
        const confidence = Math.min(95, Math.max(60, 80 + (totalQuantity / 10)));
        
        // Determine trend based on recent performance
        const recentWeek = new Date();
        recentWeek.setDate(recentWeek.getDate() - 7);
        const recentItemOrders = itemOrders.filter(orderItem => {
          const order = orders.find((o: any) => o.id === orderItem.orderId);
          return order && new Date(order.createdAt) >= recentWeek;
        });
        const recentQuantity = recentItemOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        const previousWeekQuantity = totalQuantity - recentQuantity;
        
        const trend = recentQuantity > previousWeekQuantity ? 'up' : 
                     recentQuantity < previousWeekQuantity ? 'down' : 'stable';
        
        // Generate peak hours (simplified)
        const peakHours = ['12:00 PM', '1:00 PM', '7:00 PM', '8:00 PM'];
        
        return {
          item: item.name,
          predictedDemand,
          confidence: Math.round(confidence),
          peakHours,
          trend
        };
      });

      return res.json(demandPredictions);
    } catch (error) {
      console.error('Error generating demand predictions:', error);
      return res.status(500).json({ message: 'Failed to generate demand predictions' });
    }
  });

  // Food Pairings Analytics
  app.get('/api/restaurants/:restaurantId/analytics/food-pairings', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'day';
      const now = new Date();
      let startDate: Date;
      switch (timeframe) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      const orders = await storage.getOrdersByRestaurantId(restaurantId);
      const menuItems = await storage.getMenuItems(restaurantId);
      if (!orders || orders.length === 0 || !menuItems || menuItems.length === 0) {
        return res.json({
          topPairings: [],
          recommendations: [],
          totalOrders: orders ? orders.length : 0,
          totalPairings: 0
        });
      }

      // Filter orders by timeframe
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= now;
      });

      // Fetch all order items for the restaurant in one query
      const allOrderItems = await storage.getOrderItemsByRestaurantId(restaurantId) as { orderItems: OrderItem, orders: Order }[];
      // Group order items by orderId
      const orderItemsByOrderId: Map<number, OrderItem[]> = new Map();
      for (const item of allOrderItems) {
        const orderId = item.orderItems.orderId;
        if (!orderItemsByOrderId.has(orderId)) orderItemsByOrderId.set(orderId, []);
        orderItemsByOrderId.get(orderId)!.push(item.orderItems);
      }

      // Create a map of menu item names
      const menuItemMap = new Map(menuItems.map(item => [item.id, item.name]));

      // Analyze food pairings
      const pairings = new Map<string, number>();

      // For each filtered order, find all combinations of items ordered together
      for (const order of filteredOrders) {
        const orderItemsForOrder = orderItemsByOrderId.get(order.id) || [];
        if (orderItemsForOrder.length < 2) continue;

        // Get all unique item IDs in this order
        const itemIds = [...new Set(orderItemsForOrder.map(item => item.menuItemId))];
        
        // Generate all possible pairs
        for (let i = 0; i < itemIds.length; i++) {
          for (let j = i + 1; j < itemIds.length; j++) {
            const item1Name = menuItemMap.get(itemIds[i]);
            const item2Name = menuItemMap.get(itemIds[j]);
            if (item1Name && item2Name) {
              const pairKey = [item1Name, item2Name].sort().join(' + ');
              pairings.set(pairKey, (pairings.get(pairKey) || 0) + 1);
            }
          }
        }
      }

      // Convert to array and sort by frequency
      const topPairings = Array.from(pairings.entries())
        .map(([pair, count]) => ({
          pair,
          count,
          items: pair.split(' + '),
          percentage: Math.round((count / filteredOrders.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate recommendations based on pairings
      const recommendations = [];
      
      // Recommend promoting popular pairings
      topPairings.slice(0, 3).forEach(pairing => {
        if (pairing.count >= 3) {
          recommendations.push({
            type: 'combo_meal',
            items: pairing.items,
            reason: `Popular pairing ordered ${pairing.count} times. Consider creating a combo meal.`,
            potential_revenue: pairing.count * 2 // Estimate additional revenue
          });
        }
      });

      // Find items that are rarely paired
      const allItems = new Set(menuItems.map(item => item.name));
      const pairedItems = new Set(topPairings.flatMap(p => p.items));
      const unpairedItems = Array.from(allItems).filter(item => !pairedItems.has(item));

      if (unpairedItems.length > 0) {
        recommendations.push({
          type: 'suggest_pairing',
          items: unpairedItems.slice(0, 3),
          reason: 'These items are rarely ordered together. Consider suggesting pairings to customers.',
          potential_revenue: unpairedItems.length * 1.5
        });
      }

      return res.json({
        topPairings,
        recommendations,
        totalOrders: filteredOrders.length,
        totalPairings: pairings.size
      });
    } catch (error) {
      console.error('Error analyzing food pairings:', error);
      return res.status(500).json({ message: 'Failed to analyze food pairings' });
    }
  });

  console.log("Analytics routes set up successfully");

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

  // AI Insights Endpoints
  app.get('/api/restaurants/:restaurantId/ai-insights', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) return res.status(400).json({ message: 'Invalid restaurant ID' });
      
      // Convert query params to Date objects if they exist
      const dateRange = req.query.startDate && req.query.endDate ? {
        startDate: new Date(req.query.startDate as string),
        endDate: new Date(req.query.endDate as string)
      } : undefined;

      const insights = await storage.getAiInsightsByRestaurantId(restaurantId);
      
      // Filter insights by date range if provided
      const filteredInsights = dateRange
        ? insights.filter(insight => {
            const insightDate = new Date(insight.createdAt);
            return insightDate >= dateRange.startDate && insightDate <= dateRange.endDate;
          })
        : insights;

      return res.json(filteredInsights);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      return res.status(500).json({ message: 'Failed to fetch AI insights' });
    }
  });

  app.post('/api/restaurants/:restaurantId/ai-insights/generate', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) return res.status(400).json({ message: 'Invalid restaurant ID' });

      // Check if restaurant exists
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      // Generate insights
      const insights = await generateRestaurantInsights(restaurantId);
      if (!insights || insights.length === 0) {
        return res.status(500).json({ 
          message: 'No insights could be generated',
          details: !process.env.GEMINI_API_KEY ? 'AI service not configured' : undefined
        });
      }

      return res.json(insights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ 
        message: 'Failed to generate AI insights',
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  app.put('/api/restaurants/:restaurantId/ai-insights/:insightId/read', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const insightId = parseInt(req.params.insightId);
      if (isNaN(restaurantId) || isNaN(insightId)) return res.status(400).json({ message: 'Invalid ID' });
      await storage.markAiInsightAsRead(insightId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error marking AI insight as read:', error);
      return res.status(500).json({ message: 'Failed to mark as read' });
    }
  });

  app.put('/api/restaurants/:restaurantId/ai-insights/:insightId/status', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const insightId = parseInt(req.params.insightId);
      const { status } = req.body;
      if (isNaN(restaurantId) || isNaN(insightId) || !status) return res.status(400).json({ message: 'Invalid request' });
      await storage.updateAiInsightStatus(insightId, status);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error updating AI insight status:', error);
      return res.status(500).json({ message: 'Failed to update status' });
    }
  });

  // AI Stats Endpoint
  app.get('/api/restaurants/:restaurantId/ai-stats', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Get insights count and status
      const insights = await storage.getAiInsightsByRestaurantId(restaurantId);
      const newInsights = insights.filter(insight => !insight.isRead).length;
      const pendingRecommendations = insights.filter(insight => insight.implementationStatus === 'pending').length;

      // Get active chat sessions (sessions from the last 24 hours)
      // TODO: Implement real chat session tracking in the future
      // For now, return 0 for chatSessions (not dummy data)
      const chatStats = {
        aiInsightsAvailable: newInsights,
        chatSessions: 0,
        recommendations: pendingRecommendations
      };
      return res.json(chatStats);
    } catch (error) {
      console.error('Error fetching AI stats:', error);
      return res.status(500).json({ message: 'Failed to fetch AI stats' });
    }
  });

  // AI Chat Endpoints
  app.post('/api/restaurants/:restaurantId/ai-chat', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate chat request body
      if (!req.body.message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      // Format the request according to the expected schema
      const chatRequest = {
        message: req.body.message,
        context: {
          restaurantId,
          timeframe: '30d' // default to last 30 days
        }
      };

      const reply = await handleRestaurantChat(chatRequest);
      return res.json({ reply });
    } catch (error) {
      console.error('AI Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ 
        message: 'Failed to get AI response',
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  app.post('/api/restaurants/:restaurantId/analytics/ai-insights', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) return res.status(400).json({ message: 'Invalid restaurant ID' });

      const validation = dateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate, endDate } = validation.data;
      const insights = await generateAnalyticsInsights({ restaurantId, startDate, endDate });
      return res.json(insights);
    } catch (error) {
      console.error('Error generating analytics AI insights:', error);
      return res.status(500).json({ message: 'Failed to generate analytics AI insights' });
    }
  });

  // Get all orders for a table session (batch fetch for billing)
  app.get('/api/restaurants/:restaurantId/table-sessions/:tableSessionId/orders', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableSessionId = parseInt(req.params.tableSessionId);
      if (isNaN(restaurantId) || isNaN(tableSessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant or table session ID' });
      }
      const orders = await storage.getOrdersByTableSessionId(tableSessionId);
      return res.json(orders);
    } catch (error) {
      console.error('Error fetching orders for table session:', error);
      return res.status(500).json({ message: 'Failed to fetch orders for table session' });
    }
  });

  // Get bills for a table session (with pagination)
  app.get('/api/restaurants/:restaurantId/table-sessions/:tableSessionId/bills', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const tableSessionId = parseInt(req.params.tableSessionId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      if (isNaN(restaurantId) || isNaN(tableSessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant or table session ID' });
      }
      const bills = await storage.getBillsByTableSessionId(tableSessionId, limit, offset);
      return res.json(bills);
    } catch (error) {
      console.error('Error fetching bills for table session:', error);
      return res.status(500).json({ message: 'Failed to fetch bills for table session' });
    }
  });

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
