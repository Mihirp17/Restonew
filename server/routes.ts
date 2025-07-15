import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from 'express-session';
import { sessionConfig, authenticate, authorize, authorizeRestaurant, loginPlatformAdmin, loginRestaurant, loginUser } from "./auth";
import { setupWebSocketServer } from "./socket";
import { z } from "zod";
import { 
  insertRestaurantSchema, 
  insertUserSchema, 
  insertMenuItemSchema, 
  insertTableSchema, 
  insertOrderSchema, 
  insertOrderItemSchema, 
  insertFeedbackSchema, 
  insertApplicationFeedbackSchema 
} from "@shared/schema";
import { 
  billSchema, 
  updateBillSchema,
  loginSchema as sharedLoginSchema, 
  dateRangeSchema as sharedDateRangeSchema,
  validateData
} from "@shared/validations";
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
      const validation = sharedLoginSchema.safeParse(req.body);
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

  // Public update table session endpoint (for status changes)
  app.put('/api/public/restaurants/:restaurantId/table-sessions/:sessionId', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      // Verify the session belongs to this restaurant
      const existingSession = await storage.getTableSession(sessionId);
      if (!existingSession || existingSession.restaurantId !== restaurantId) {
        return res.status(404).json({ message: 'Table session not found' });
      }

      // Only allow certain status updates for public endpoint
      const allowedUpdates = ['status'];
      const updates = Object.keys(req.body).reduce((acc: Record<string, unknown>, key) => {
        if (allowedUpdates.includes(key)) {
          acc[key] = req.body[key];
        }
        return acc;
      }, {});

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No valid updates provided' });
      }

      const updatedSession = await storage.updateTableSession(sessionId, updates);
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
      console.error('Error fetching session bills:', error);
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

  app.put('/api/restaurants/:restaurantId/bills/:billId', authenticate, authorizeRestaurant, async (req, res, next) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const billId = parseInt(req.params.billId);
      
      if (isNaN(restaurantId) || isNaN(billId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or bill ID' });
      }

      // Validate with shared schema
      const validation = validateData(updateBillSchema, req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid bill data', 
          errors: validation.errors 
        });
      }

      // Check if bill belongs to restaurant
      const bill = await storage.getBill(billId);
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }
      
      const session = await storage.getTableSession(bill.tableSessionId);
      if (!session || session.restaurantId !== restaurantId) {
        return res.status(403).json({ message: 'Bill does not belong to this restaurant' });
      }

      // Ensure validation.data is not undefined
      if (!validation.data) {
        return res.status(400).json({ message: 'Invalid bill data' });
      }

      const updatedBill = await storage.updateBill(billId, validation.data);
      if (!updatedBill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      return res.json(updatedBill);
    } catch (error) {
      next(error);
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

  // Public menu endpoint with categories for customer menu
  app.get('/api/public/restaurants/:restaurantId/menu-items', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Get menu items and group them by category
      const menuItems = await storage.getMenuItems(restaurantId);
      
      // Group items by category (assuming category is a string field)
      const categoryMap = new Map<string, any[]>();
      menuItems.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(item);
      });

      // Convert to array format with category objects
      const categories = Array.from(categoryMap.entries()).map(([name, items], index) => ({
        id: index + 1,
        name,
        items
      }));

      return res.json({
        categories,
        allItems: menuItems
      });
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

      let { tableId, partySize, status, tableNumber } = req.body;

      // If tableId is not provided but tableNumber is, resolve tableId
      if ((!tableId || isNaN(parseInt(tableId))) && tableNumber !== undefined) {
        // Find the table by restaurantId and number
        const tables = await storage.getTablesByRestaurantId(restaurantId);
        const foundTable = tables.find(t => t.number === Number(tableNumber));
        if (!foundTable) {
          return res.status(404).json({ message: 'Table with given number not found' });
        }
        tableId = foundTable.id;
      }

      if (!tableId || isNaN(parseInt(tableId))) {
        return res.status(400).json({ message: 'Valid table ID is required' });
      }
      tableId = parseInt(tableId);

      // Validate restaurant exists
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }

      // Validate table exists and belongs to restaurant
      const table = await storage.getTable(tableId);
      if (!table || table.restaurantId !== restaurantId) {
        return res.status(404).json({ message: 'Table not found' });
      }

      const session = await storage.createTableSession({
        restaurantId,
        tableId,
        partySize: partySize || 1,
        status: status || 'waiting',
        sessionName: `Table ${table.number}`,
        splitType: 'individual'
      });

      return res.status(201).json(session);
    } catch (error: unknown) {
      console.error('Error creating table session:', error);
      // Handle specific error types
      if (error instanceof Error && error.message?.includes('already has an active session')) {
        return res.status(409).json({ message: error.message });
      }
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

      // Validate session exists and belongs to restaurant
      const session = await storage.getTableSession(parseInt(tableSessionId));
      if (!session || session.restaurantId !== restaurantId) {
        return res.status(404).json({ message: 'Table session not found' });
      }

      const customer = await storage.createCustomer({
        tableSessionId: parseInt(tableSessionId),
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        isMainCustomer: isMainCustomer || false
      });

              // If this is the main customer, we could update the session in the future
        // For now, we'll just create the customer without updating the session
        if (isMainCustomer) {
          // TODO: Add mainCustomerId field to tableSessions schema if needed
          console.log(`Main customer ${customer.id} created for session ${tableSessionId}`);
        }

      return res.status(201).json(customer);
    } catch (error: unknown) {
      console.error('Error creating customer:', error);
      
      // Handle specific error types
      if (error instanceof Error && error.message?.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof Error && error.message?.includes('Cannot add customer to session')) {
        return res.status(400).json({ message: error.message });
      }
      
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

  // Public create order endpoint for customers
  app.post('/api/public/restaurants/:restaurantId/orders', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      let { customerId, tableSessionId, items, notes, tableId, tableNumber } = req.body;

      // If tableId is not provided but tableNumber is, resolve tableId
      if ((!tableId || isNaN(parseInt(tableId))) && tableNumber !== undefined) {
        // Find the table by restaurantId and number
        const tables = await storage.getTablesByRestaurantId(restaurantId);
        const foundTable = tables.find(t => t.number === Number(tableNumber));
        if (!foundTable) {
          return res.status(404).json({ message: 'Table with given number not found' });
        }
        tableId = foundTable.id;
      }

      if (!customerId || !tableSessionId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
          message: 'Customer ID, table session ID, and items are required' 
        });
      }

      // Validate items structure
      for (const item of items) {
        if (!item.menuItemId || !item.quantity || item.quantity <= 0 || !item.price || item.price <= 0) {
          return res.status(400).json({ 
            message: 'Each item must have valid menuItemId, quantity > 0, and price > 0' 
          });
        }
      }

      // Get the table session to get the table ID
      const tableSession = await storage.getTableSession(parseInt(tableSessionId));
      if (!tableSession || tableSession.restaurantId !== restaurantId) {
        return res.status(404).json({ message: 'Table session not found' });
      }

      // Validate customer exists and belongs to session
      const customer = await storage.getCustomer(parseInt(customerId));
      if (!customer || customer.tableSessionId !== parseInt(tableSessionId)) {
        return res.status(404).json({ message: 'Customer not found or does not belong to session' });
      }

      // Calculate total from items
      const total = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * item.quantity);
      }, 0);

      // Use tableId from session if not provided
      if (!tableId) {
        tableId = tableSession.tableId;
      }

      // Create the order
      const orderData = {
        restaurantId,
        customerId: parseInt(customerId),
        tableSessionId: parseInt(tableSessionId),
        tableId,
        orderNumber: '', // Will be generated by storage layer
        status: 'pending',
        total: total.toFixed(2),
        notes: notes || null,
        isGroupOrder: false
      };

      const order = await storage.createOrder(orderData);

      // Batch create order items
      const orderItemsArray = items.map((item: any) => ({
          orderId: order.id,
        menuItemId: parseInt(item.menuItemId),
          quantity: item.quantity,
        price: parseFloat(item.price).toFixed(2),
          customizations: item.notes || null
      }));
      await storage.batchCreateOrderItems(orderItemsArray);

      return res.status(201).json({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt
      });
    } catch (error: unknown) {
      console.error('Error creating order:', error);
      // Handle specific error types
      if (error instanceof Error && error.message?.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof Error && error.message?.includes('Cannot create order')) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message?.includes('does not belong to session')) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Failed to create order' });
    }
  });

  // Public get orders for customer
  app.get('/api/public/restaurants/:restaurantId/customers/:customerId/orders', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const customerId = parseInt(req.params.customerId);
      
      if (isNaN(restaurantId) || isNaN(customerId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or customer ID' });
      }

      const orders = await storage.getOrdersByCustomerId(customerId);
      
      // Filter by restaurant to ensure security
      const restaurantOrders = orders.filter(order => order.restaurantId === restaurantId);
      
      return res.json(restaurantOrders);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  // Public get orders for table session
  app.get('/api/public/restaurants/:restaurantId/table-sessions/:sessionId/orders', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      const orders = await storage.getOrdersByTableSessionId(sessionId);
      
      // Filter by restaurant to ensure security
      const restaurantOrders = orders.filter(order => order.restaurantId === restaurantId);
      
      // Get order items for each order with menu item details
      const ordersWithItems = await Promise.all(
        restaurantOrders.map(async (order) => {
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
          
          return { ...order, items: itemsWithDetails };
        })
      );
      
      return res.json(ordersWithItems);
    } catch (error) {
      console.error('Error fetching session orders:', error);
      return res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  // Public get bills for table session
  app.get('/api/public/restaurants/:restaurantId/table-sessions/:sessionId/bills', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      const bills = await storage.getBillsByTableSessionId(sessionId);
      
      return res.json(bills);
    } catch (error) {
      console.error('Error fetching session bills:', error);
      return res.status(500).json({ message: 'Failed to fetch bills' });
    }
  });

  // Public create bill for customer
  app.post('/api/public/restaurants/:restaurantId/bills', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate required fields
      const { billNumber, tableSessionId, customerId, type, subtotal, tax, tip, total } = req.body;
      
      if (!billNumber || !tableSessionId || !type || !subtotal || !total) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Check if bill already exists for this customer and session (for individual bills)
      if (customerId) {
        const existingBill = await storage.getBillByCustomerAndSession(customerId, tableSessionId);
        if (existingBill) {
          return res.status(409).json({ message: 'Bill already exists for this customer and session' });
        }
      }

      const bill = await storage.createBill({
        billNumber,
        tableSessionId,
        customerId: customerId || null,
        type,
        subtotal,
        tax: tax || '0.00',
        tip: tip || '0.00',
        total,
        status: 'pending',
        paymentMethod: req.body.paymentMethod || null
      });

      return res.status(201).json(bill);
    } catch (error) {
      console.error('Error creating bill:', error);
      return res.status(500).json({ message: 'Failed to create bill' });
    }
  });

  // Public mark bill as paid
  app.post('/api/public/restaurants/:restaurantId/bills/:billId/pay', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const billId = parseInt(req.params.billId);
      
      if (isNaN(restaurantId) || isNaN(billId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or bill ID' });
      }

      const { paymentMethod } = req.body;

      // Update bill status to paid
      const updatedBill = await storage.updateBill(billId, {
        status: 'paid',
        paymentMethod: paymentMethod || 'cash',
        paidAt: new Date()
      });

      if (!updatedBill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      return res.json(updatedBill);
    } catch (error) {
      console.error('Error processing payment:', error);
      return res.status(500).json({ message: 'Failed to process payment' });
    }
  });

  // Public request waiter for bill
  app.post('/api/public/restaurants/:restaurantId/table-sessions/:sessionId/request-bill', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      const { customerId, customerName } = req.body;

      // Mark session as requesting bill
      await storage.updateTableSession(sessionId, {
        billRequested: true,
        billRequestedAt: new Date()
      });

      // Create waiter request via WebSocket if available
      const waiterRequest = {
        id: Date.now(),
        tableSessionId: sessionId,
        customerId,
        customerName: customerName || 'Customer',
        requestType: 'bill-payment',
        message: `${customerName || 'Customer'} is requesting the bill`,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      // Emit to restaurant staff via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant-${restaurantId}`).emit('waiterRequest', waiterRequest);
      }

      return res.json({ message: 'Bill request sent to waiter', requestId: waiterRequest.id });
    } catch (error) {
      console.error('Error requesting bill:', error);
      return res.status(500).json({ message: 'Failed to request bill' });
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
      console.log('API: Calling getActiveOrdersLightweight with:', { restaurantId, limit });
      
      const orders = await storage.getActiveOrdersLightweight(restaurantId, limit);
      
      console.log('API: getActiveOrdersLightweight returned:', orders.length, 'orders');
      console.log('API: First order sample:', orders[0]);

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
      const clients = (global as { wsClients?: Array<{ restaurantId: number; socket: WebSocket }> }).wsClients || [];
      
      // Send to all restaurant staff clients
      clients.forEach((client) => {
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

      const validation = sharedDateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate: startDateStr, endDate: endDateStr } = validation.data;
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
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

      const validation = sharedDateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate: startDateStr, endDate: endDateStr } = validation.data;
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
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

      const validation = sharedDateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate: startDateStr, endDate: endDateStr } = validation.data;
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
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

      const validation = sharedDateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate: startDateStr, endDate: endDateStr } = validation.data;
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
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
      const options: any = {};
      if (req.query.startDate && req.query.endDate) {
        options.startDate = new Date(req.query.startDate as string);
        options.endDate = new Date(req.query.endDate as string);
        console.log('Popular items API: Date range received:', { startDate: options.startDate, endDate: options.endDate });
      }
      console.log('Popular items API: Calling storage with options:', { restaurantId, limit, options });
      const popularItems = await storage.getPopularMenuItems(restaurantId, limit, options);
      console.log('Popular items API: Result:', popularItems);
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
      
      // Calculate date range based on timeframe (matching menu analytics structure)
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
      const orderItemsPromises = filteredOrders.map(order => storage.getOrderItemsByOrderId(order.id));
      const orderItemsArrays = await Promise.all(orderItemsPromises);
      const orderItems = orderItemsArrays.flat();

      // Get current period orders for real-time confidence adjustment
      let currentPeriodStart: Date;
      let currentPeriodOrders: any[];
      let currentPeriodOrderItems: any[];
      
      switch (timeframe) {
        case 'day':
          // For daily view, current period is today
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          currentPeriodOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= currentPeriodStart && orderDate <= now;
          });
          break;
        case 'week':
          // For weekly view, current period is current week
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
          weekStart.setHours(0, 0, 0, 0);
          currentPeriodStart = weekStart;
          currentPeriodOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= currentPeriodStart && orderDate <= now;
          });
          break;
        case 'month':
          // For monthly view, current period is current month
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          currentPeriodOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= currentPeriodStart && orderDate <= now;
          });
          break;
        default:
          currentPeriodStart = startDate;
          currentPeriodOrders = filteredOrders;
      }

      const currentPeriodOrderItemsPromises = currentPeriodOrders.map(order => storage.getOrderItemsByOrderId(order.id));
      const currentPeriodOrderItemsArrays = await Promise.all(currentPeriodOrderItemsPromises);
      currentPeriodOrderItems = currentPeriodOrderItemsArrays.flat();

      // Generate demand predictions for each menu item with improved real-time logic
      const demandPredictions = menuItems.slice(0, 8).map(item => {
        const itemOrders = orderItems.filter(orderItem => orderItem.menuItemId === item.id);
        const currentPeriodItemOrders = currentPeriodOrderItems.filter(orderItem => orderItem.menuItemId === item.id);
        const totalQuantity = itemOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        const currentPeriodQuantity = currentPeriodItemOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        
        // Calculate demand prediction with timeframe-appropriate logic
        const daysInPeriod = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const avgDailyDemand = totalQuantity / daysInPeriod;
        
        // Calculate trend based on recent vs older data within the timeframe
        const midPoint = new Date(startDate.getTime() + (now.getTime() - startDate.getTime()) / 2);
        const recentOrders = itemOrders.filter(orderItem => {
          const order = orders.find((o) => o.id === orderItem.orderId);
          return order && new Date(order.createdAt) >= midPoint;
        });
        const olderOrders = itemOrders.filter(orderItem => {
          const order = orders.find((o) => o.id === orderItem.orderId);
          return order && new Date(order.createdAt) < midPoint;
        });
        
        const recentQuantity = recentOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        const olderQuantity = olderOrders.reduce((sum: number, orderItem) => sum + orderItem.quantity, 0);
        
        // Calculate growth rate with minimum sample size requirements
        const recentDays = Math.max(1, Math.ceil((now.getTime() - midPoint.getTime()) / (1000 * 60 * 60 * 24)));
        const olderDays = Math.max(1, Math.ceil((midPoint.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        const recentDailyAvg = recentQuantity / recentDays;
        const olderDailyAvg = olderQuantity / olderDays;
        
        // Only calculate growth rate if we have sufficient data
        let growthRate = 1.0; // No change by default
        if (olderDailyAvg > 0 && olderQuantity >= 3 && recentQuantity >= 3) {
          growthRate = recentDailyAvg / olderDailyAvg;
          // Cap extreme growth rates to prevent unrealistic predictions
          growthRate = Math.max(0.5, Math.min(2.0, growthRate));
        }
        
        // Predict demand with growth trend and timeframe-specific adjustments
        let predictedDemand = Math.round(avgDailyDemand * growthRate);
        
        // Adjust prediction based on timeframe
        switch (timeframe) {
          case 'day':
            // For daily view, predict next day's demand
            predictedDemand = Math.round(avgDailyDemand * growthRate);
            break;
          case 'week':
            // For weekly view, predict next week's total demand
            predictedDemand = Math.round(avgDailyDemand * 7 * growthRate);
            break;
          case 'month':
            // For monthly view, predict next month's total demand
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            predictedDemand = Math.round(avgDailyDemand * daysInMonth * growthRate);
            break;
        }
        
        // Calculate real-time confidence with timeframe-appropriate adjustments
        let confidence = 40; // Lower base confidence for more realistic assessment
        
        // Increase confidence based on data volume within the timeframe
        if (totalQuantity >= 50) confidence += 25;
        else if (totalQuantity >= 20) confidence += 20;
        else if (totalQuantity >= 10) confidence += 15;
        else if (totalQuantity >= 5) confidence += 10;
        else if (totalQuantity >= 2) confidence += 5;
        
        // Increase confidence based on data consistency (lower variance = higher confidence)
        if (itemOrders.length > 1) {
          const quantities = itemOrders.map(oi => oi.quantity);
          const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
          const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
          const stdDev = Math.sqrt(variance);
          const coefficientOfVariation = stdDev / mean;
          
          // Lower coefficient of variation = higher confidence
          if (coefficientOfVariation < 0.3) confidence += 20;
          else if (coefficientOfVariation < 0.5) confidence += 15;
          else if (coefficientOfVariation < 0.7) confidence += 10;
          else if (coefficientOfVariation < 1.0) confidence += 5;
        }
        
        // Real-time confidence adjustment based on current period activity
        const currentHour = now.getHours();
        const businessHours = currentHour >= 6 && currentHour <= 22; // Assume 6 AM to 10 PM business hours
        
        if (businessHours) {
          // If item is being ordered in current period, increase confidence
          if (currentPeriodQuantity > 0) {
            confidence += Math.min(15, currentPeriodQuantity * 3); // +3% per order, max +15%
          }
          
          // Adjust confidence based on timeframe-specific expectations
          let expectedOrdersByNow: number;
          switch (timeframe) {
            case 'day':
              const hoursSinceOpen = currentHour - 6;
              expectedOrdersByNow = Math.round(avgDailyDemand * (hoursSinceOpen / 16)); // Assume 16-hour business day
              break;
            case 'week':
              const daysSinceWeekStart = Math.ceil((now.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
              expectedOrdersByNow = Math.round(avgDailyDemand * daysSinceWeekStart);
              break;
            case 'month':
              const daysSinceMonthStart = Math.ceil((now.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
              expectedOrdersByNow = Math.round(avgDailyDemand * daysSinceMonthStart);
              break;
            default:
              expectedOrdersByNow = 0;
          }
          
          if (currentPeriodQuantity >= expectedOrdersByNow * 0.8) {
            confidence += 10; // Meeting expected demand
          } else if (currentPeriodQuantity < expectedOrdersByNow * 0.5) {
            confidence -= 10; // Below expected demand
          }
        }
        
        // Increase confidence for items with recent orders (last 24 hours)
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recent24hOrders = itemOrders.filter(orderItem => {
          const order = orders.find((o) => o.id === orderItem.orderId);
          return order && new Date(order.createdAt) >= last24Hours;
        });
        
        if (recent24hOrders.length > 0) {
          confidence += Math.min(10, recent24hOrders.length * 2); // +2% per recent order, max +10%
        }
        
        // Cap confidence at 95%
        confidence = Math.min(95, Math.max(20, confidence));
        
        // Determine trend based on growth rate and current period activity
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (growthRate > 1.15 || currentPeriodQuantity > avgDailyDemand * 1.2) {
          trend = 'up';
        } else if (growthRate < 0.85 || (currentPeriodQuantity > 0 && currentPeriodQuantity < avgDailyDemand * 0.8)) {
          trend = 'down';
        }
        
        // Calculate peak hours from actual order timestamps within the timeframe
        const orderHours = itemOrders.map(orderItem => {
          const order = orders.find((o) => o.id === orderItem.orderId);
          if (order) {
            const orderDate = new Date(order.createdAt);
            return orderDate.getHours();
          }
          return null;
        }).filter(hour => hour !== null);
        
        // Find most common hours (peak hours)
        const hourCounts = new Map<number, number>();
        orderHours.forEach(hour => {
          if (hour !== null) {
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          }
        });
        
        // Get top 3 peak hours
        const sortedHours = Array.from(hourCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hour]) => {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:00 ${period}`;
          });
        
        // Fallback to default peak hours if no data
        const peakHours = sortedHours.length > 0 ? sortedHours : ['12:00 PM', '1:00 PM', '7:00 PM'];
        
        return {
          item: item.name,
          predictedDemand,
          confidence: Math.round(confidence),
          peakHours,
          trend,
          currentPeriodOrders: currentPeriodQuantity, // Current period orders for transparency
          totalOrders: totalQuantity, // Total orders in timeframe for context
          timeframe: timeframe // Include timeframe for frontend reference
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

      // Create a map of menu item names and categories
      const menuItemMap = new Map(menuItems.map(item => [item.id, { name: item.name, category: item.category || 'Uncategorized' }]));

      // Analyze food pairings
      const pairings = new Map<string, number>();

      // For each filtered order, find all combinations of items ordered together
      for (const order of filteredOrders) {
        const orderItemsForOrder = orderItemsByOrderId.get(order.id) || [];
        if (orderItemsForOrder.length < 2) continue;

        // Get all unique item IDs in this order
        const itemIds = [...new Set(orderItemsForOrder.map(item => item.menuItemId))];
        // Generate all possible pairs, but only if from different categories
        for (let i = 0; i < itemIds.length; i++) {
          for (let j = i + 1; j < itemIds.length; j++) {
            const item1 = menuItemMap.get(itemIds[i]);
            const item2 = menuItemMap.get(itemIds[j]);
            if (item1 && item2 && item1.category !== item2.category) {
              const pairKey = [item1.name, item2.name].sort().join(' + ');
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

      // Find items that are rarely paired (from different categories only)
      const allItems = new Set(menuItems.map(item => item.name));
      const pairedItems = new Set(topPairings.flatMap(p => p.items));
      const unpairedItems = Array.from(allItems).filter(item => !pairedItems.has(item));

      // Only suggest pairings between unpaired items from different categories
      if (unpairedItems.length > 1) {
        // Build a list of unpaired items with their categories
        const unpairedWithCat = menuItems.filter(item => unpairedItems.includes(item.name)).map(item => ({ name: item.name, category: item.category || 'Uncategorized' }));
        // Find the first 3 pairs from different categories
        const suggestedPairs = [];
        for (let i = 0; i < unpairedWithCat.length; i++) {
          for (let j = i + 1; j < unpairedWithCat.length; j++) {
            if (unpairedWithCat[i].category !== unpairedWithCat[j].category) {
              suggestedPairs.push(unpairedWithCat[i].name + ' + ' + unpairedWithCat[j].name);
              if (suggestedPairs.length >= 3) break;
            }
          }
          if (suggestedPairs.length >= 3) break;
        }
        if (suggestedPairs.length > 0) {
        recommendations.push({
          type: 'suggest_pairing',
            items: suggestedPairs[0].split(' + '),
            reason: 'These items are rarely ordered together and are from different categories. Consider suggesting pairings to customers.',
            potential_revenue: suggestedPairs.length * 1.5
          });
        }
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

      const validation = sharedDateRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }

      const { startDate: startDateStr, endDate: endDateStr } = validation.data;
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const insights = await generateAnalyticsInsights({ restaurantId, startDate, endDate });
      return res.json(insights);
    } catch (error) {
      console.error('Error generating analytics AI insights:', error);
      return res.status(500).json({ message: 'Failed to generate analytics AI insights' });
    }
  });

  // Quick Stats Endpoint
  app.get('/api/restaurants/:restaurantId/quick-stats', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const { getQuickStats } = await import('./ai.js');
      const stats = await getQuickStats(restaurantId);
      return res.json(stats);
    } catch (error) {
      console.error('Error fetching quick stats:', error);
      return res.status(500).json({ message: 'Failed to fetch quick stats' });
    }
  });

  // Historical Comparison Endpoint
  app.get('/api/restaurants/:restaurantId/historical-comparison', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      const { getHistoricalComparison } = await import('./ai.js');
      const comparison = await getHistoricalComparison(restaurantId, days);
      return res.json(comparison);
    } catch (error) {
      console.error('Error fetching historical comparison:', error);
      return res.status(500).json({ message: 'Failed to fetch historical comparison' });
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

  // Optimized join session endpoint
  app.post('/api/public/restaurants/:restaurantId/join-session', async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }
      const { tableId, customerName, email, phone, isMainCustomer } = req.body;
      if (!tableId || isNaN(parseInt(tableId))) {
        return res.status(400).json({ message: 'Valid table ID is required' });
      }
      if (!customerName || !customerName.trim()) {
        return res.status(400).json({ message: 'Customer name is required' });
      }
      // Find or create active session for this table
      let session = null;
      const sessions = await storage.getTableSessionsByRestaurantId(restaurantId);
      session = sessions.find(s => s.tableId === parseInt(tableId) && ['waiting', 'active'].includes(s.status));
      if (!session) {
        // Create new session
        const table = await storage.getTable(parseInt(tableId));
        if (!table || table.restaurantId !== restaurantId) {
          return res.status(404).json({ message: 'Table not found' });
        }
        session = await storage.createTableSession({
          restaurantId,
          tableId: parseInt(tableId),
          partySize: 1,
          status: 'waiting',
          sessionName: `Table ${table.number}`,
          splitType: 'individual'
        });
      }
      // Add customer if not present
      let customer = null;
      const customers = await storage.getCustomersByTableSessionId(session.id);
      customer = customers.find(c => c.name === customerName && c.email === (email?.trim() || null));
      if (!customer) {
        customer = await storage.createCustomer({
          tableSessionId: session.id,
          name: customerName.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          isMainCustomer: isMainCustomer || false
        });
        // If main customer, we could update the session in the future
        if (isMainCustomer) {
          // TODO: Add mainCustomerId field to tableSessions schema if needed
          console.log(`Main customer ${customer.id} created for session ${session.id}`);
        }
      }
      // Return session, customer, and all customers
      const allCustomers = await storage.getCustomersByTableSessionId(session.id);
      return res.status(200).json({ session, customer, customers: allCustomers });
    } catch (error) {
      console.error('Error in join-session:', error);
      return res.status(500).json({ message: 'Failed to join session' });
    }
  });

  // Admin endpoint to cleanup empty sessions and ghost customers
  app.post('/api/admin/cleanup-empty-sessions', async (req, res) => {
    try {
      const timeoutMinutes = req.body.timeoutMinutes || 30;
      const result = await storage.cleanupEmptySessions(timeoutMinutes);
      return res.json(result);
    } catch (error) {
      console.error('Error cleaning up empty sessions:', error);
      return res.status(500).json({ message: 'Failed to cleanup empty sessions' });
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

  // Application Feedback Routes
  console.log("Setting up application feedback routes...");
  app.post('/api/restaurants/:restaurantId/application-feedback', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }
      const validation = insertApplicationFeedbackSchema.safeParse({
        ...req.body,
        restaurantId,
        userId: req.session.user?.id || null
      });
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.errors });
      }
      const feedback = await storage.createApplicationFeedback(validation.data);
      return res.status(201).json(feedback);
    } catch (error) {
      console.error('Error creating application feedback:', error);
      return res.status(500).json({ message: 'Failed to create application feedback' });
    }
  });

  app.get('/api/restaurants/:restaurantId/application-feedback', authenticate, authorizeRestaurant, async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }
      const feedbackList = await storage.getApplicationFeedbackByRestaurantId(restaurantId);
      return res.json(feedbackList);
    } catch (error) {
      console.error('Error fetching application feedback:', error);
      return res.status(500).json({ message: 'Failed to fetch application feedback' });
    }
  });

  console.log("Route registration completed successfully");

  // Batch API endpoint for session data with orders, customers, and bills
  app.get('/api/restaurants/:restaurantId/table-sessions/:sessionId/combined', authenticate, authorizeRestaurant, async (req, res, next) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      // Get session data
      const session = await storage.getTableSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Table session not found' });
      }
      
      if (session.restaurantId !== restaurantId) {
        return res.status(403).json({ message: 'Session does not belong to this restaurant' });
      }
      
      // Get all related data in parallel
      const [sessionCustomers, sessionOrders, sessionBills, sessionTable] = await Promise.all([
        storage.getCustomersByTableSessionId(sessionId),
        storage.getOrdersByTableSessionId(sessionId),
        storage.getBillsByTableSessionId(sessionId),
        session.tableId ? storage.getTable(session.tableId) : null
      ]);
      
      // Get menu items for all orders
      const menuItemIds = new Set<number>();
      sessionOrders.forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            menuItemIds.add(item.menuItemId);
          });
        }
      });
      
      // If there are menu items, fetch them
      let menuItems: any[] = [];
      if (menuItemIds.size > 0) {
        menuItems = await storage.getMenuItemsByIds(Array.from(menuItemIds));
      }
      
      // Build menu item lookup map
      const menuItemsMap = menuItems.reduce((acc: Record<number, any>, item: any) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<number, any>);
      
      // Enhance orders with menu item details
      const enhancedOrders = sessionOrders.map((order: any) => {
        return {
          ...order,
          items: order.items && Array.isArray(order.items) ? order.items.map((item: any) => {
            const menuItem = menuItemsMap[item.menuItemId];
            return {
              ...item,
              menuItemName: menuItem?.name || 'Unknown Item',
              menuItemPrice: menuItem?.price || '0.00',
              category: menuItem?.category || 'Uncategorized'
            };
          }) : []
        };
      });
      
      // Group orders by customer
      const ordersByCustomer = enhancedOrders.reduce((acc: Record<number, any[]>, order: any) => {
        if (!acc[order.customerId]) {
          acc[order.customerId] = [];
        }
        acc[order.customerId].push(order);
        return acc;
      }, {} as Record<number, any[]>);
      
      // Combine bills with customers
      const customersWithBills = sessionCustomers.map(customer => {
        const customerBills = sessionBills.filter(bill => bill.customerId === customer.id);
        const customerOrders = ordersByCustomer[customer.id] || [];
        const totalAmount = customerOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
        
        return {
          ...customer,
          bills: customerBills,
          orders: customerOrders,
          totalAmount: totalAmount.toFixed(2)
        };
      });
      
      // Build the combined response
      const combinedData = {
        session: {
          ...session,
          table: sessionTable
        },
        customers: customersWithBills,
        orders: enhancedOrders,
        bills: sessionBills,
        combinedBills: sessionBills.filter(bill => bill.type === 'combined'),
      };
      
      return res.json(combinedData);
    } catch (error) {
      next(error);
    }
  });

  // Add endpoint to check session completion status
  app.get('/api/restaurants/:restaurantId/table-sessions/:sessionId/completion-status', authenticate, authorizeRestaurant, async (req, res, next) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      // Check if session belongs to restaurant
      const session = await storage.getTableSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Table session not found' });
      }
      
      if (session.restaurantId !== restaurantId) {
        return res.status(403).json({ message: 'Session does not belong to this restaurant' });
      }

      // Check if session can be completed
      const completionStatus = await storage.canCompleteSession(sessionId);
      return res.json(completionStatus);
    } catch (error) {
      next(error);
    }
  });

  // Add endpoint to force-complete a session
  app.post('/api/restaurants/:restaurantId/table-sessions/:sessionId/force-complete', authenticate, authorizeRestaurant, async (req, res, next) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(restaurantId) || isNaN(sessionId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or session ID' });
      }

      // Check if session belongs to restaurant
      const session = await storage.getTableSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Table session not found' });
      }
      
      if (session.restaurantId !== restaurantId) {
        return res.status(403).json({ message: 'Session does not belong to this restaurant' });
      }

      const { reason = 'Forced by admin' } = req.body;
      await storage.forceCompleteSession(sessionId, reason);
      
      return res.json({ 
        success: true, 
        message: 'Session force-completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Create a bill
  app.post('/api/restaurants/:restaurantId/bills', authenticate, authorizeRestaurant, async (req, res, next) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID' });
      }

      // Validate with shared schema
      const validation = validateData(billSchema, req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid bill data', 
          errors: validation.errors 
        });
      }

      const validatedData = validation.data;
      
      // Helper function to generate a bill number
      const generateBillNumber = () => {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `BILL-${timestamp}-${random}`;
      };
      
      // Check if bill already exists for this customer and session (for individual bills)
      if (validatedData && validatedData.customerId) {
        const existingBill = await storage.getBillByCustomerAndSession(validatedData.customerId, validatedData.tableSessionId);
        if (existingBill) {
          return res.status(409).json({ message: 'Bill already exists for this customer and session' });
        }
      }

      if (!validatedData) {
        return res.status(400).json({ message: 'Invalid bill data' });
      }

      const bill = await storage.createBill({
        ...validatedData,
        billNumber: validatedData.billNumber || generateBillNumber(),
        status: validatedData.status || 'pending',
        tax: validatedData.tax || '0.00',
        tip: validatedData.tip || '0.00'
      });

      return res.status(201).json(bill);
    } catch (error) {
      next(error);
    }
  });

  // Update a bill
  app.put('/api/restaurants/:restaurantId/bills/:billId', authenticate, authorizeRestaurant, async (req, res, next) => {
    try {
      const restaurantId = parseInt(req.params.restaurantId);
      const billId = parseInt(req.params.billId);
      
      if (isNaN(restaurantId) || isNaN(billId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID or bill ID' });
      }

      // Validate with shared schema
      const validation = validateData(updateBillSchema, req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid bill data', 
          errors: validation.errors 
        });
      }

      // Check if bill belongs to restaurant
      const bill = await storage.getBill(billId);
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found' });
      }
      
      const session = await storage.getTableSession(bill.tableSessionId);
      if (!session || session.restaurantId !== restaurantId) {
        return res.status(403).json({ message: 'Bill does not belong to this restaurant' });
      }

      // Ensure validation.data is not undefined
      if (!validation.data) {
        return res.status(400).json({ message: 'Invalid bill data' });
      }

      const updatedBill = await storage.updateBill(billId, validation.data);
      if (!updatedBill) {
        return res.status(404).json({ message: 'Bill not found' });
      }

      return res.json(updatedBill);
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
