import { 
  type PlatformAdmin, type InsertPlatformAdmin, platformAdmins,
  type Restaurant, type InsertRestaurant, restaurants,
  type Subscription, type InsertSubscription, subscriptions,
  type Table, type InsertTable, tables,
  type MenuItem, type InsertMenuItem, menuItems,
  type Order, type InsertOrder, orders,
  type OrderItem, type InsertOrderItem, orderItems,
  type User, type InsertUser, users,
  type Feedback, type InsertFeedback, feedback,
  type AiInsight, type InsertAiInsight, aiInsights,
  type TableSession, type InsertTableSession, tableSessions,
  type Customer, type InsertCustomer, customers,
  type Bill, type InsertBill, bills,
  type ApplicationFeedback, type InsertApplicationFeedback, applicationFeedback
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, lt } from "drizzle-orm";
import bcrypt from 'bcryptjs';

// Generic storage interface with all required methods
export interface IStorage {
  // Platform Admin Methods
  getPlatformAdmin(id: number): Promise<PlatformAdmin | undefined>;
  getPlatformAdminByEmail(email: string): Promise<PlatformAdmin | undefined>;
  createPlatformAdmin(admin: InsertPlatformAdmin): Promise<PlatformAdmin>;

  // Restaurant Methods
  getRestaurant(id: number): Promise<Restaurant | undefined>;
  getRestaurantByEmail(email: string): Promise<Restaurant | undefined>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  getAllRestaurants(): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: number, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined>;
  
  // Subscription Methods
  getSubscription(id: number): Promise<Subscription | undefined>;
  getSubscriptionByRestaurantId(restaurantId: number): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  updateSubscriptionByRestaurantId(restaurantId: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  
  // Table Methods
  getTable(id: number): Promise<Table | undefined>;
  getTablesByRestaurantId(restaurantId: number): Promise<Table[]>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: number, table: Partial<InsertTable>): Promise<Table | undefined>;
  deleteTable(id: number): Promise<boolean>;
  
  // MenuItem Methods
  getMenuItem(id: number): Promise<MenuItem | undefined>;
  getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]>;
  createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, menuItem: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: number): Promise<boolean>;
  
  // Order Methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByRestaurantId(restaurantId: number, options?: { startDate?: Date, endDate?: Date }): Promise<Order[]>;
  getActiveOrdersByRestaurantId(restaurantId: number, limit?: number): Promise<Order[]>;
  getActiveOrdersLightweight(restaurantId: number, limit?: number): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName?: string, tableNumber?: number}[]>;
  getActiveOrdersThin(restaurantId: number, limit?: number): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName: string, tableNumber: number}[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;
  getOrdersByCustomerId(customerId: number): Promise<Order[]>;
  getOrdersByTableSessionId(tableSessionId: number): Promise<Order[]>;
  
  // OrderItem Methods
  getOrderItem(id: number): Promise<OrderItem | undefined>;
  getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  deleteOrderItemsByOrderId(orderId: number): Promise<boolean>;
  
  // User Methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  deleteUserByEmail(email: string): Promise<boolean>;
  getUsersByRestaurantId(restaurantId: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Feedback Methods
  getFeedback(id: number): Promise<Feedback | undefined>;
  getFeedbackByRestaurantId(restaurantId: number, options?: { startDate?: Date, endDate?: Date }): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;

  // Application Feedback Methods
  createApplicationFeedback(feedbackItem: InsertApplicationFeedback): Promise<ApplicationFeedback>;
  getApplicationFeedbackByRestaurantId(restaurantId: number): Promise<ApplicationFeedback[]>;

  // Analytics Methods
  getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getPopularMenuItems(restaurantId: number, limit: number, options?: { startDate?: Date, endDate?: Date }): Promise<{id: number, name: string, count: number, price: string}[]>;
  
  // Payment related helpers (Stripe removed)
  // updateRestaurantStripeInfo removed - placeholder implementation
  
  // AI Insights methods
  getAiInsightsByRestaurantId(restaurantId: number): Promise<AiInsight[]>;
  createAiInsight(insight: InsertAiInsight): Promise<AiInsight>;
  updateAiInsight(insightId: number, updates: Partial<InsertAiInsight>): Promise<AiInsight>;
  markAiInsightAsRead(insightId: number): Promise<void>;
  updateAiInsightStatus(insightId: number, status: string): Promise<void>;

  // Table Session Methods
  getTableSession(id: number): Promise<TableSession | undefined>;
  getTableSessionsByRestaurantId(restaurantId: number, status?: string): Promise<any[]>;
  createTableSession(session: InsertTableSession): Promise<TableSession>;
  updateTableSession(id: number, session: Partial<InsertTableSession>): Promise<TableSession | undefined>;
  
  // Customer Methods
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomersByTableSessionId(tableSessionId: number): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // Bill Methods
  getBill(id: number): Promise<Bill | undefined>;
  getBillsByRestaurantId(restaurantId: number, status?: string): Promise<any[]>;
  getBillsByTableSessionId(tableSessionId: number): Promise<Bill[]>;
  getBillByCustomerAndSession(customerId: number, tableSessionId: number): Promise<Bill | undefined>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined>;
  checkAllCustomersBillsPaid(tableSessionId: number): Promise<boolean>;
  updateSessionPaymentProgress(tableSessionId: number): Promise<void>;
  calculateSessionTotals(tableSessionId: number): Promise<void>;
  invalidateSessionCache(tableSessionId: number): Promise<void>;
  syncTableOccupancy(restaurantId: number): Promise<void>;
  cleanupEmptySessions(timeoutMinutes: number): Promise<{ removedSessions: number, removedCustomers: number }>;

  // Mock menu items for test restaurant
  getMenuItems(restaurantId: number): Promise<MenuItem[]>;
  getMenuItemsByIds(menuItemIds: number[]): Promise<MenuItem[]>;

  // Log or update a chat session for a restaurant
  logAiChatSession(params: { restaurantId: number, userId?: number, sessionId?: string }): Promise<number | undefined>;

  // Count unique chat sessions for a restaurant in the last 24h
  countAiChatSessionsLast24h(restaurantId: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Transaction wrapper utility for standardizing transaction usage
  private async withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      try {
        return await callback(tx);
      } catch (error) {
        console.error('Transaction error:', error);
        throw error;
      }
    });
  }

  constructor() {
    this.initializeDefaultAdmin();
  }

  private async initializeDefaultAdmin() {
    const admin = await this.getPlatformAdminByEmail('admin@restomate.com');
    if (!admin) {
      await this.createPlatformAdmin({
        email: 'admin@restomate.com',
        password: 'admin123',
        name: 'System Admin'
      });
    }
  }

  // Platform Admin Methods
  async getPlatformAdmin(id: number): Promise<PlatformAdmin | undefined> {
    const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, id));
    return admin;
  }

  async getPlatformAdminByEmail(email: string): Promise<PlatformAdmin | undefined> {
    const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, email));
    return admin;
  }

  async createPlatformAdmin(admin: InsertPlatformAdmin): Promise<PlatformAdmin> {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const [newAdmin] = await db
      .insert(platformAdmins)
      .values({ ...admin, password: hashedPassword })
      .returning();
    return newAdmin;
  }

  // Restaurant Methods
  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async getRestaurantByEmail(email: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.email, email));
    return restaurant;
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, slug));
    return restaurant;
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants);
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const hashedPassword = await bcrypt.hash(restaurant.password, 10);
    const [newRestaurant] = await db
      .insert(restaurants)
      .values({ ...restaurant, password: hashedPassword })
      .returning();
    return newRestaurant;
  }

  async updateRestaurant(id: number, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined> {
    // If password is included, hash it
    let updatedData = { ...restaurant };
    if (restaurant.password) {
      updatedData.password = await bcrypt.hash(restaurant.password, 10);
    }
    
    const [updatedRestaurant] = await db
      .update(restaurants)
      .set({ ...updatedData, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    return updatedRestaurant;
  }

  // Subscription Methods
  async getSubscription(id: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription;
  }

  async getSubscriptionByRestaurantId(restaurantId: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.restaurantId, restaurantId));
    return subscription;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }

  async updateSubscription(id: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updatedSubscription;
  }

  async updateSubscriptionByRestaurantId(restaurantId: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.restaurantId, restaurantId))
      .returning();
    return updatedSubscription;
  }

  // Table Methods
  async getTable(id: number): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.id, id));
    return table;
  }

  async getTablesByRestaurantId(restaurantId: number): Promise<Table[]> {
    return await db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
  }

  async createTable(table: InsertTable): Promise<Table> {
    const [newTable] = await db
      .insert(tables)
      .values(table)
      .returning();
    return newTable;
  }

  async updateTable(id: number, table: Partial<InsertTable>): Promise<Table | undefined> {
    const [updatedTable] = await db
      .update(tables)
      .set({ ...table, updatedAt: new Date() })
      .where(eq(tables.id, id))
      .returning();
    return updatedTable;
  }

  async deleteTable(id: number): Promise<boolean> {
    const result = await db
      .delete(tables)
      .where(eq(tables.id, id))
      .returning();
    return result.length > 0;
  }

  // MenuItem Methods
  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    const [menuItem] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return menuItem;
  }

  async getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    const [newMenuItem] = await db
      .insert(menuItems)
      .values(menuItem)
      .returning();
    return newMenuItem;
  }

  async updateMenuItem(id: number, menuItem: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [updatedMenuItem] = await db
      .update(menuItems)
      .set({ ...menuItem, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    return updatedMenuItem;
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    const result = await db
      .delete(menuItems)
      .where(eq(menuItems.id, id))
      .returning();
    return result.length > 0;
  }

  // Order Methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByRestaurantId(restaurantId: number, options: { startDate?: Date, endDate?: Date } = {}): Promise<Order[]> {
    const { startDate, endDate } = options;
    const conditions = [eq(orders.restaurantId, restaurantId)];
    if (startDate && endDate) {
      conditions.push(sql`${orders.createdAt} BETWEEN ${startDate} AND ${endDate}`);
    }
    const query = db.select().from(orders).where(and(...conditions as any)).orderBy(desc(orders.createdAt));
    return await query;
  }

  async getActiveOrdersByRestaurantId(restaurantId: number, limit?: number): Promise<Order[]> {
    // Get orders that aren't completed or cancelled
    return await db.select()
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          sql`${orders.status} NOT IN ('completed', 'cancelled')`
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit || 10); // Default to 10 if limit is not provided
  }

  async getActiveOrdersLightweight(restaurantId: number, limit?: number): Promise<any[]> {
    try {
      console.log('Storage: getActiveOrdersLightweight called with:', { restaurantId, limit });
      
      const result = await db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        displayOrderNumber: orders.displayOrderNumber,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
        customerName: customers.name,
        tableNumber: tables.number // Using 'number' field from tables schema
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(tables, eq(orders.tableId, tables.id))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          sql`${orders.status} NOT IN ('completed', 'cancelled')`
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit || 10);

      console.log('Storage: Found orders:', result.length);

      // For each order, fetch its items with menu item details
      const ordersWithItems = await Promise.all(result.map(async (row) => {
        const items = await db.select({
          id: orderItems.id,
          quantity: orderItems.quantity,
          price: orderItems.price,
          menuItemId: orderItems.menuItemId,
          menuItemName: menuItems.name
        })
        .from(orderItems)
        .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(eq(orderItems.orderId, row.id));
        
        console.log(`Storage: Order ${row.id} has ${items.length} items`);
        
        return {
        id: Number(row.id),
        orderNumber: String(row.orderNumber),
          displayOrderNumber: row.displayOrderNumber ? Number(row.displayOrderNumber) : undefined,
        status: String(row.status),
        total: String(row.total),
        createdAt: new Date(row.createdAt),
        customerName: row.customerName ? String(row.customerName) : undefined,
          tableNumber: row.tableNumber ? Number(row.tableNumber) : undefined,
          items: items.map(item => ({
            id: Number(item.id),
            quantity: Number(item.quantity),
            price: String(item.price),
            menuItemId: Number(item.menuItemId),
            menuItemName: String(item.menuItemName)
          }))
        };
      }));

      console.log('Storage: Returning orders with items:', ordersWithItems.length);
      return ordersWithItems;
    } catch (error) {
      console.error('Error in getActiveOrdersLightweight:', error);
      return [];
    }
  }

  async getActiveOrdersThin(restaurantId: number, limit?: number): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName: string, tableNumber: number}[]> {
    try {
      const result = await db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
        customerName: customers.name,
        tableNumber: tables.number // Using 'number' field from tables schema
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(tables, eq(orders.tableId, tables.id))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          sql`${orders.status} NOT IN ('completed', 'cancelled')`
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit || 10);

      return result.map(row => ({
        id: Number(row.id),
        orderNumber: String(row.orderNumber),
        status: String(row.status),
        total: String(row.total),
        createdAt: new Date(row.createdAt),
        customerName: String(row.customerName),
        tableNumber: Number(row.tableNumber)
      }));
    } catch (error) {
      console.error('Error in getActiveOrdersThin:', error);
      return [];
    }
  }

  // Generate a sequential display order number per restaurant
  private async generateSequentialDisplayOrderNumber(restaurantId: number): Promise<number> {
    // Get the max displayOrderNumber for this restaurant
    const result = await db.select({ max: sql<number>`MAX(${orders.displayOrderNumber})` })
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId));
    const maxNumber = result[0]?.max || 0;
    return maxNumber + 1;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    // Validate session and customer exist and are active
    const session = await this.getTableSession(order.tableSessionId);
    if (!session) {
      throw new Error(`Table session ${order.tableSessionId} not found`);
    }
    
    if (!['waiting', 'active'].includes(session.status)) {
      throw new Error(`Cannot create order for session with status: ${session.status}`);
    }

    const customer = await this.getCustomer(order.customerId);
    if (!customer) {
      throw new Error(`Customer ${order.customerId} not found`);
    }

    if (customer.tableSessionId !== order.tableSessionId) {
      throw new Error(`Customer ${order.customerId} does not belong to session ${order.tableSessionId}`);
    }

    // Generate unique order number
    const orderNumber = await this.generateUniqueOrderNumber(order.restaurantId);
    // Generate sequential display order number
    const displayOrderNumber = await this.generateSequentialDisplayOrderNumber(order.restaurantId);

    const [newOrder] = await db.insert(orders).values({
      ...order,
      orderNumber,
      displayOrderNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    // Invalidate session cache when new order is created
    if (newOrder.tableSessionId) {
      await this.invalidateSessionCache(newOrder.tableSessionId);
    }
    
    return newOrder;
  }

  private async generateUniqueOrderNumber(restaurantId: number): Promise<string> {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `R${restaurantId}-${timestamp}-${random}`;
    
    // Check if order number already exists (very unlikely but safe)
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    
    if (existingOrder.length > 0) {
      // Retry with different random number
      return this.generateUniqueOrderNumber(restaurantId);
    }
    
    return orderNumber;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    
    // Invalidate session cache when order is updated
    if (updatedOrder?.tableSessionId) {
      await this.invalidateSessionCache(updatedOrder.tableSessionId);
    }
    
    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const result = await db
      .delete(orders)
      .where(eq(orders.id, id))
      .returning();
    return result.length > 0;
  }

  // OrderItem Methods
  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    const [orderItem] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return orderItem;
  }

  async getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values(orderItem)
      .returning();
    return newOrderItem;
  }

  async deleteOrderItemsByOrderId(orderId: number): Promise<boolean> {
    const result = await db
      .delete(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .returning();
    return result.length > 0;
  }

  async getOrderItemsByRestaurantId(restaurantId: number): Promise<{ orderItems: OrderItem, orders: Order }[]> {
    // Join orderItems with orders to filter by restaurantId
    return await db.select({ orderItems, orders })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orders.restaurantId, restaurantId));
  }

  async batchCreateOrderItems(orderItemsArray: InsertOrderItem[]): Promise<OrderItem[]> {
    if (!orderItemsArray || orderItemsArray.length === 0) return [];
    const inserted = await db
      .insert(orderItems)
      .values(orderItemsArray)
      .returning();
    return inserted;
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async deleteUserByEmail(email: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.email, email))
      .returning();
    return result.length > 0;
  }

  async getUsersByRestaurantId(restaurantId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.restaurantId, restaurantId));
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db
      .insert(users)
      .values({ ...user, password: hashedPassword })
      .returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    // If password is included, hash it
    let updatedData = { ...user };
    if (user.password) {
      updatedData.password = await bcrypt.hash(user.password, 10);
    }
    
    const [updatedUser] = await db
      .update(users)
      .set({ ...updatedData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Feedback Methods
  async getFeedback(id: number): Promise<Feedback | undefined> {
    const [feedbackItem] = await db.select().from(feedback).where(eq(feedback.id, id));
    return feedbackItem;
  }

  async getFeedbackByRestaurantId(restaurantId: number, options: { startDate?: Date, endDate?: Date } = {}): Promise<Feedback[]> {
    const { startDate, endDate } = options;
    const conditions = [eq(feedback.restaurantId, restaurantId)];
    if (startDate && endDate) {
      conditions.push(sql`${feedback.createdAt} BETWEEN ${startDate} AND ${endDate}`);
    }
    const query = db.select().from(feedback).where(and(...conditions as any));
    return await query;
  }

  async createFeedback(feedbackItem: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values(feedbackItem)
      .returning();
    return newFeedback;
  }

  // Application Feedback Methods
  async createApplicationFeedback(feedbackItem: InsertApplicationFeedback): Promise<ApplicationFeedback> {
    const [newFeedback] = await db
      .insert(applicationFeedback)
      .values(feedbackItem)
      .returning();
    return newFeedback;
  }

  async getApplicationFeedbackByRestaurantId(restaurantId: number): Promise<ApplicationFeedback[]> {
    return await db.select().from(applicationFeedback).where(eq(applicationFeedback.restaurantId, restaurantId));
  }

  // Analytics Methods - Optimized for performance
  async getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    try {
    const result = await db.select({
        revenue: sql<string>`COALESCE(SUM(${bills.total}), 0)`,
    })
      .from(bills)
      .innerJoin(tableSessions, eq(bills.tableSessionId, tableSessions.id))
    .where(
      and(
          eq(tableSessions.restaurantId, restaurantId),
          sql`${bills.createdAt} >= ${startDate.toISOString()}`,
          sql`${bills.createdAt} <= ${endDate.toISOString()}`,
          eq(bills.status, 'paid')
      )
    );
    
    return result[0]?.revenue ? parseFloat(result[0].revenue) : 0;
    } catch (error) {
      console.error('Error in getRestaurantRevenue:', error);
      return 0;
    }
  }

  async getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    try {
    const result = await db.select({
        count: sql<number>`COUNT(*)::integer`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        sql`${orders.createdAt} >= ${startDate.toISOString()}`,
        sql`${orders.createdAt} <= ${endDate.toISOString()}`,
          sql`${orders.status} NOT IN ('cancelled')`
      )
    );
    
    return result[0]?.count || 0;
    } catch (error) {
      console.error('Error in getOrderCountByRestaurantId:', error);
      return 0;
    }
  }

  async getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    try {
    const result = await db.select({
        average: sql<string>`COALESCE(AVG(CASE WHEN ${orders.status} NOT IN ('cancelled') THEN ${orders.total}::numeric ELSE NULL END), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        sql`${orders.createdAt} >= ${startDate.toISOString()}`,
        sql`${orders.createdAt} <= ${endDate.toISOString()}`
      )
    );
    
    return result[0]?.average ? parseFloat(result[0].average) : 0;
    } catch (error) {
      console.error('Error in getAverageOrderValue:', error);
      return 0;
    }
  }

  async getPopularMenuItems(restaurantId: number, limit: number, options: { startDate?: Date, endDate?: Date } = {}): Promise<{id: number, name: string, count: number, price: string}[]> {
    const { startDate, endDate } = options;
    
    try {
      console.log('Storage: getPopularMenuItems called with:', { restaurantId, limit, startDate, endDate });
      
      // Debug: Check if there are any orders in the database
      const allOrders = await db.select().from(orders).where(eq(orders.restaurantId, restaurantId));
      console.log('Storage: Total orders in database for restaurant:', allOrders.length);
      if (allOrders.length > 0) {
        console.log('Storage: Sample order dates:', allOrders.slice(0, 3).map(o => ({ id: o.id, createdAt: o.createdAt, status: o.status })));
      }

      const conditions = [eq(menuItems.restaurantId, restaurantId)];
      let query = db.select({
        id: menuItems.id,
        name: menuItems.name,
        price: menuItems.price,
        count: sql<number>`COUNT(${orderItems.id})::integer`
      })
      .from(menuItems)
      .leftJoin(orderItems, sql`${menuItems.id} = ${orderItems.menuItemId}`)
      .leftJoin(orders, sql`${orderItems.orderId} = ${orders.id} AND ${orders.status} != 'cancelled'`);

      // Add date filtering condition if dates are provided
      if (startDate && endDate) {
        console.log('Storage: Applying date filter:', { startDate, endDate });
        conditions.push(sql`${orders.createdAt} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`);
      } else {
        console.log('Storage: No date filter applied');
      }

      const result = await query
      .where(and(...conditions as any))
      .groupBy(menuItems.id, menuItems.name, menuItems.price)
      .orderBy(desc(sql`COUNT(${orderItems.id})`))
      .limit(limit);
      
      console.log('Storage: Query result:', result);
      
      // Filter out items with 0 orders when date filtering is applied
      const filteredResult = startDate && endDate 
        ? result.filter(row => Number(row.count) > 0)
        : result;
      
      console.log('Storage: Filtered result:', filteredResult);
      
      return filteredResult.map(row => ({
        id: Number(row.id),
        name: String(row.name),
        count: Number(row.count || 0),
        price: String(row.price)
      }));
    } catch (error) {
      console.error('Error in getPopularMenuItems:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // Payment Helpers (Stripe removed - placeholder implementation)
  // Stripe-related functionality has been removed and replaced with placeholder subscription management

  // AI Insights Implementation
  async getAiInsightsByRestaurantId(restaurantId: number): Promise<AiInsight[]> {
    try {
      const result = await db.select().from(aiInsights).where(eq(aiInsights.restaurantId, restaurantId));
      return result;
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      return [];
    }
  }

  async createAiInsight(insight: InsertAiInsight): Promise<AiInsight> {
    try {
      const result = await db.insert(aiInsights).values({
        restaurantId: insight.restaurantId,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        recommendations: insight.recommendations,
        dataSource: insight.dataSource,
        confidence: insight.confidence.toString(),
        priority: insight.priority,
        isRead: insight.isRead,
        implementationStatus: insight.implementationStatus
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating AI insight:', error);
      throw error;
    }
  }

  async updateAiInsight(insightId: number, updates: Partial<InsertAiInsight>): Promise<AiInsight> {
    try {
      const result = await db
        .update(aiInsights)
        .set(updates)
        .where(eq(aiInsights.id, insightId))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating AI insight:', error);
      throw error;
    }
  }

  async markAiInsightAsRead(insightId: number): Promise<void> {
    await db.update(aiInsights).set({ isRead: true }).where(eq(aiInsights.id, insightId));
  }

  async updateAiInsightStatus(insightId: number, status: string): Promise<void> {
    await db.update(aiInsights).set({ implementationStatus: status }).where(eq(aiInsights.id, insightId));
  }

  // Table Session Methods
  async getTableSession(id: number): Promise<TableSession | undefined> {
    const [session] = await db.select().from(tableSessions).where(eq(tableSessions.id, id));
    return session;
  }

  async getTableSessionsByRestaurantId(restaurantId: number, status?: string): Promise<any[]> {
    let sessions: TableSession[];
    
    if (status) {
      sessions = await db.select().from(tableSessions).where(
        and(
          eq(tableSessions.restaurantId, restaurantId),
          eq(tableSessions.status, status)
        )
      );
    } else {
      sessions = await db.select().from(tableSessions).where(eq(tableSessions.restaurantId, restaurantId));
    }

    // Enrich each session with customers and table data
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        // Get customers for this session
        const customers = await this.getCustomersByTableSessionId(session.id);
        
        // Get table details
        const table = await this.getTable(session.tableId);
        
        return {
          ...session,
          customers,
          table
        };
      })
    );

    return enrichedSessions;
  }

  async createTableSession(session: InsertTableSession): Promise<TableSession> {
    // Use withTransaction wrapper for consistency and error handling
    return this.withTransaction(async (tx) => {
      // Check for existing active session with proper locking
      const existingSession = await tx
        .select()
        .from(tableSessions)
        .where(
          and(
            eq(tableSessions.tableId, session.tableId),
            eq(tableSessions.restaurantId, session.restaurantId),
            inArray(tableSessions.status, ['waiting', 'active'])
          )
        )
        .limit(1);

      if (existingSession.length > 0) {
        // Lookup table number for error message
        const table = await tx.select().from(tables).where(eq(tables.id, session.tableId)).limit(1);
        const tableNumber = table[0]?.number ?? session.tableId;
        throw new Error(`Table ${tableNumber} already has an active session`);
      }

      // Create session with optimistic locking
      const [newSession] = await tx
      .insert(tableSessions)
        .values({
          ...session,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      .returning();

      // Update table occupancy status
      await tx
        .update(tables)
        .set({ isOccupied: true, updatedAt: new Date() })
        .where(eq(tables.id, session.tableId));

    return newSession;
    });
  }

  async updateTableSession(id: number, session: Partial<InsertTableSession>): Promise<TableSession | undefined> {
    // Handle timestamp fields that might come as strings from the frontend
    const sanitizedSession = { ...session };
    
    // Convert timestamp strings to Date objects if they exist
    if (sanitizedSession.endTime && typeof sanitizedSession.endTime === 'string') {
      sanitizedSession.endTime = new Date(sanitizedSession.endTime);
    }
    if (sanitizedSession.billRequestedAt && typeof sanitizedSession.billRequestedAt === 'string') {
      sanitizedSession.billRequestedAt = new Date(sanitizedSession.billRequestedAt);
    }
    if (sanitizedSession.startTime && typeof sanitizedSession.startTime === 'string') {
      sanitizedSession.startTime = new Date(sanitizedSession.startTime);
    }

    // Validate status transitions
    if (sanitizedSession.status) {
      const currentSession = await this.getTableSession(id);
      if (currentSession) {
        const validTransitions = this.getValidStatusTransitions(currentSession.status);
        if (!validTransitions.includes(sanitizedSession.status)) {
          throw new Error(`Invalid status transition from ${currentSession.status} to ${sanitizedSession.status}`);
        }
      }
    }

    const [updatedSession] = await db
      .update(tableSessions)
      .set({ ...sanitizedSession, updatedAt: new Date() })
      .where(eq(tableSessions.id, id))
      .returning();

    // Update table occupancy if session status changed
    if (updatedSession && sanitizedSession.status) {
      await this.syncTableOccupancy(updatedSession.restaurantId);
    }

    return updatedSession;
  }

  private getValidStatusTransitions(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
      'waiting': ['active', 'cancelled', 'completed'],
      'active': ['completed', 'cancelled'],
      'completed': [], // Terminal state
      'cancelled': []  // Terminal state
    };
    return transitions[currentStatus] || [];
  }
  
  // Customer Methods
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomersByTableSessionId(tableSessionId: number): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.tableSessionId, tableSessionId));
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    // Validate that the session exists and is active
    const session = await this.getTableSession(customer.tableSessionId);
    if (!session) {
      throw new Error(`Table session ${customer.tableSessionId} not found`);
    }
    
    if (!['waiting', 'active'].includes(session.status)) {
      throw new Error(`Cannot add customer to session with status: ${session.status}`);
    }

    const [newCustomer] = await db
      .insert(customers)
      .values({
        ...customer,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newCustomer;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }
  
  // Bill Methods
  async getBill(id: number): Promise<Bill | undefined> {
    const [bill] = await db.select().from(bills).where(eq(bills.id, id));
    return bill;
  }

  async getBillsByRestaurantId(restaurantId: number, status?: string): Promise<any[]> {
    const baseCondition = eq(tableSessions.restaurantId, restaurantId);
    const condition = status ? and(baseCondition, eq(bills.status, status)) : baseCondition;

    const results = await db.select({
      bill: bills,
      customer: customers
    })
      .from(bills)
      .innerJoin(tableSessions, eq(bills.tableSessionId, tableSessions.id))
      .leftJoin(customers, eq(bills.customerId, customers.id))
      .where(condition)
      .orderBy(desc(bills.createdAt));

    return results.map(r => ({ ...r.bill, customer: r.customer }));
  }

  async getBillsByTableSessionId(tableSessionId: number, limit: number = 30, offset: number = 0): Promise<Bill[]> {
    return await db.select().from(bills)
      .where(eq(bills.tableSessionId, tableSessionId))
      .orderBy(desc(bills.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getBillByCustomerAndSession(customerId: number, tableSessionId: number): Promise<Bill | undefined> {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.customerId, customerId), eq(bills.tableSessionId, tableSessionId)));
    return bill;
  }

  async createBill(bill: InsertBill): Promise<Bill> {
    // Validate session exists and is active
    const session = await this.getTableSession(bill.tableSessionId);
    if (!session) {
      throw new Error(`Table session ${bill.tableSessionId} not found`);
    }
    
    if (!['waiting', 'active'].includes(session.status)) {
      throw new Error(`Cannot create bill for session with status: ${session.status}`);
    }

    // Validate customer if individual bill
    if (bill.customerId) {
      const customer = await this.getCustomer(bill.customerId);
      if (!customer) {
        throw new Error(`Customer ${bill.customerId} not found`);
      }
      
      if (customer.tableSessionId !== bill.tableSessionId) {
        throw new Error(`Customer ${bill.customerId} does not belong to session ${bill.tableSessionId}`);
      }

      // Check if customer already has a bill for this session
      const existingBill = await this.getBillByCustomerAndSession(bill.customerId, bill.tableSessionId);
      if (existingBill) {
        throw new Error(`Customer ${bill.customerId} already has a bill for session ${bill.tableSessionId}`);
      }
    }

    // Generate unique bill number
    const billNumber = await this.generateUniqueBillNumber(bill.tableSessionId);

    const [newBill] = await db
      .insert(bills)
      .values({
        ...bill,
        billNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Invalidate session cache when new bill is created
    await this.invalidateSessionCache(bill.tableSessionId);

    return newBill;
  }

  private async generateUniqueBillNumber(tableSessionId: number): Promise<string> {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const billNumber = `B${tableSessionId}-${timestamp}-${random}`;
    
    // Check if bill number already exists
    const existingBill = await db
      .select()
      .from(bills)
      .where(eq(bills.billNumber, billNumber))
      .limit(1);
    
    if (existingBill.length > 0) {
      // Retry with different random number
      return this.generateUniqueBillNumber(tableSessionId);
    }
    
    return billNumber;
  }

  async updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined> {
    return this.withTransaction(async (tx) => {
      const [updatedBill] = await tx
      .update(bills)
      .set({ ...bill, updatedAt: new Date() })
      .where(eq(bills.id, id))
      .returning();
    
      if (!updatedBill) {
        return undefined;
      }
      
    // Invalidate session cache when bill is updated
    if (updatedBill?.tableSessionId) {
      await this.invalidateSessionCache(updatedBill.tableSessionId);
    }
    
    // If bill status is changed to 'paid', update customer payment status
      if (bill.status === 'paid') {
        if (updatedBill.customerId) {
          // For individual bills, mark the specific customer as paid
          await tx
            .update(customers)
            .set({ paymentStatus: 'paid', updatedAt: new Date() })
            .where(eq(customers.id, updatedBill.customerId));
        } else {
          // For combined/partial bills, need to determine which customers it covers
          try {
            // Get the bill to check its type
            const [billDetails] = await tx
              .select()
              .from(bills)
              .where(eq(bills.id, id))
              .limit(1);
            
            if (billDetails?.type === 'combined') {
              // Combined bill - mark all customers in the session as paid
              await tx
                .update(customers)
                .set({ paymentStatus: 'paid', updatedAt: new Date() })
                .where(eq(customers.tableSessionId, updatedBill.tableSessionId));
            } 
            // For partial bills, we can't determine which customers are covered
          } catch (error) {
            console.error(`[Storage] Error updating customer payment status for bill ${id}:`, error);
          }
        }
      
      // Check if all customers have paid and update session accordingly
      await this.updateSessionPaymentProgress(updatedBill.tableSessionId);
    }
    
    return updatedBill;
    });
  }

  async checkAllCustomersBillsPaid(tableSessionId: number): Promise<boolean> {
    try {
      // Use a more atomic approach by joining customers and bills in a single query
      const customersWithBills = await db
        .select({
          customerId: customers.id,
          billId: bills.id,
          billStatus: bills.status
        })
        .from(customers)
        .leftJoin(
          bills,
          and(
            eq(bills.customerId, customers.id),
            eq(bills.tableSessionId, customers.tableSessionId)
          )
        )
        .where(eq(customers.tableSessionId, tableSessionId));

      if (customersWithBills.length === 0) {
        return false; // No customers found
      }

      // Check if all customers have associated paid bills
      const unpaidCustomers = customersWithBills.filter(
        row => row.billId === null || row.billStatus !== 'paid'
      );

      return unpaidCustomers.length === 0;
    } catch (error) {
      console.error(`[Storage] Error checking bill payments for session ${tableSessionId}:`, error);
      return false; // Fail safe by assuming not all bills are paid
    }
  }

  // Check if a session can be marked as completed
  async canCompleteSession(tableSessionId: number): Promise<{
    canComplete: boolean;
    reason?: string;
    billsPending?: number;
    hasOrders?: boolean;
  }> {
    try {
      // Check for orders in this session
      const sessionOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.tableSessionId, tableSessionId));

      // If no orders, session can be completed immediately (no payments needed)
      if (!sessionOrders.length) {
        return { 
          canComplete: true,
          hasOrders: false
        };
      }

      // Check for bills
      const sessionBills = await db
        .select()
        .from(bills)
        .where(eq(bills.tableSessionId, tableSessionId));

      // If there are orders but no bills, bills need to be generated first
      if (sessionOrders.length > 0 && sessionBills.length === 0) {
        return { 
          canComplete: false,
          reason: 'Bills need to be generated first',
          hasOrders: true
        };
      }

      // Check if all bills are paid
      const unpaidBills = sessionBills.filter(bill => bill.status !== 'paid');
      
      return {
        canComplete: unpaidBills.length === 0,
        reason: unpaidBills.length > 0 ? 'There are unpaid bills' : undefined,
        billsPending: unpaidBills.length,
        hasOrders: true
      };
    } catch (error) {
      console.error(`[Storage] Error checking session completion status for ${tableSessionId}:`, error);
      return { 
        canComplete: false,
        reason: 'Error checking session status'
      };
    }
  }

  // Force complete a session (for abandoned sessions)
  async forceCompleteSession(tableSessionId: number, reason: string): Promise<void> {
    return this.withTransaction(async (tx) => {
      // Mark session as completed
      await tx
        .update(tableSessions)
        .set({ 
          status: 'completed', 
          endTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tableSessions.id, tableSessionId));
      
      // Update any pending bills as cancelled
      await tx
        .update(bills)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(bills.tableSessionId, tableSessionId),
            eq(bills.status, 'pending')
          )
        );
      
      // Log the forced completion
      console.log(`[Storage] Force completed session ${tableSessionId}: ${reason}`);
      
      // Get session to sync table occupancy
      const [session] = await tx
        .select()
        .from(tableSessions)
        .where(eq(tableSessions.id, tableSessionId))
        .limit(1);
        
      if (session?.restaurantId) {
        // Table occupancy sync happens outside transaction
        await this.syncTableOccupancy(session.restaurantId);
      }
    });
  }

  async updateSessionPaymentProgress(tableSessionId: number): Promise<void> {
    await this.withTransaction(async (tx) => {
      // Check for orders first - if no orders, mark as completed
      const sessionOrders = await tx
        .select()
        .from(orders)
        .where(eq(orders.tableSessionId, tableSessionId));
      
      if (sessionOrders.length === 0) {
        // No orders, so session can be marked as completed immediately
        await tx
          .update(tableSessions)
          .set({ 
            status: 'completed', 
            endTime: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tableSessions.id, tableSessionId));
        
        // Get session to sync table occupancy
        const [session] = await tx
          .select()
          .from(tableSessions)
          .where(eq(tableSessions.id, tableSessionId))
          .limit(1);
          
        if (session?.restaurantId) {
          await this.syncTableOccupancy(session.restaurantId);
        }
        return;
      }
      
      // Check if there is a combined bill for the session that is paid
      const sessionBills = await tx
        .select()
        .from(bills)
        .where(eq(bills.tableSessionId, tableSessionId));
      
      // If no bills yet but there are orders, don't complete the session
      if (sessionBills.length === 0 && sessionOrders.length > 0) {
        return;
      }
      
      // Count bills by type and status
      const combinedBills = sessionBills.filter((bill: any) => bill.type === 'combined');
      const combinedBillPaid = combinedBills.some((bill: any) => bill.status === 'paid');
      
      // If there's a paid combined bill, mark session as completed immediately
      if (combinedBillPaid) {
        await tx
          .update(tableSessions)
          .set({ 
            status: 'completed', 
            endTime: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tableSessions.id, tableSessionId));
        
        // Get session to sync table occupancy
        const [session] = await tx
          .select()
          .from(tableSessions)
          .where(eq(tableSessions.id, tableSessionId))
          .limit(1);
          
        if (session?.restaurantId) {
          // Table occupancy sync happens outside transaction because it's a separate concern
          await this.syncTableOccupancy(session.restaurantId);
        }
        return;
      }
      
      // Otherwise, check if all individual customer bills are paid using an atomic approach
      const customersWithBills = await tx
        .select({
          customerId: customers.id,
          billId: bills.id,
          billStatus: bills.status
        })
        .from(customers)
        .leftJoin(
          bills,
          and(
            eq(bills.customerId, customers.id),
            eq(bills.tableSessionId, customers.tableSessionId)
          )
        )
        .where(eq(customers.tableSessionId, tableSessionId));

      if (customersWithBills.length === 0) {
        // No customers in the session - this is an edge case
        // We already know there are orders, which means this is an inconsistent state
        // Don't complete the session automatically
        return;
      }

      // Check if all customers have associated paid bills
      const unpaidCustomers = customersWithBills.filter(
        (row: { customerId: number, billId: number | null, billStatus: string | null }) => 
          row.billId === null || row.billStatus !== 'paid'
      );
      
      const allPaid = unpaidCustomers.length === 0;
    
    if (allPaid) {
      // Mark session as completed and set end time
        await tx
          .update(tableSessions)
          .set({ 
        status: 'completed',
            endTime: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tableSessions.id, tableSessionId));
      
      // Get session to sync table occupancy for the restaurant
        const [session] = await tx
          .select()
          .from(tableSessions)
          .where(eq(tableSessions.id, tableSessionId))
          .limit(1);
          
      if (session?.restaurantId) {
          // Table occupancy sync happens outside transaction because it's a separate concern
        await this.syncTableOccupancy(session.restaurantId);
      }
    } else {
      // Calculate session totals from actual orders and bills
      await this.calculateSessionTotals(tableSessionId);
    }
    });
  }

  // Cache for session totals to avoid recalculating frequently
  private sessionTotalsCache = new Map<number, { totals: { totalAmount: string, paidAmount: string }, lastUpdated: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache TTL

  async calculateSessionTotals(tableSessionId: number): Promise<void> {
    // Check cache first
    const cached = this.sessionTotalsCache.get(tableSessionId);
    const now = Date.now();
    
    if (cached && (now - cached.lastUpdated) < this.CACHE_TTL) {
      console.log(`[Storage] Using cached session totals for session ${tableSessionId}`);
      return;
    }

    // Use transaction for consistency
    await this.withTransaction(async (tx) => {
      try {
    // Get all orders for this session with a single optimized query
        const sessionOrders = await tx
      .select()
      .from(orders)
      .where(eq(orders.tableSessionId, tableSessionId));
    
    // Calculate total from orders
    const orderTotal = sessionOrders.reduce((sum: number, order: { total: string }) => sum + parseFloat(order.total), 0);
    
    // Get bills for payment calculation with single query
        const sessionBills = await tx
          .select()
          .from(bills)
          .where(eq(bills.tableSessionId, tableSessionId));
    
    const paidAmount = sessionBills
          .filter((bill: any) => bill.status === 'paid')
      .reduce((sum: number, bill: { total: string }) => sum + parseFloat(bill.total), 0);
    
    const totals = {
      totalAmount: orderTotal.toString(),
      paidAmount: paidAmount.toString()
    };

        // Get current session to check if totals changed
        const [currentSession] = await tx
          .select()
          .from(tableSessions)
          .where(eq(tableSessions.id, tableSessionId))
          .limit(1);

    // Update session with accurate totals only if changed
    if (!currentSession || 
        currentSession.totalAmount !== totals.totalAmount || 
        currentSession.paidAmount !== totals.paidAmount) {
      
          await tx
            .update(tableSessions)
            .set({ 
              ...totals,
              updatedAt: new Date() 
            })
            .where(eq(tableSessions.id, tableSessionId));
          
      console.log(`[Storage] Updated session ${tableSessionId} totals: ${totals.totalAmount} total, ${totals.paidAmount} paid`);
    }

    // Cache the result
    this.sessionTotalsCache.set(tableSessionId, {
      totals,
      lastUpdated: now
        });
      } catch (error) {
        console.error(`[Storage] Error calculating session totals for session ${tableSessionId}:`, error);
        // Don't rethrow to prevent blocking other operations
      }
    });
  }

  // Method to invalidate session cache when orders/bills change
  async invalidateSessionCache(tableSessionId: number): Promise<void> {
    this.sessionTotalsCache.delete(tableSessionId);
    console.log(`[Storage] Invalidated cache for session ${tableSessionId}`);
  }

  async syncTableOccupancy(restaurantId: number): Promise<void> {
    // Improved table occupancy sync with better error handling
    try {
      // Get all tables for the restaurant
      const allTables = await db
      .select()
      .from(tables)
      .where(eq(tables.restaurantId, restaurantId));

      if (!allTables.length) {
        console.log(`[Storage] No tables found for restaurant ${restaurantId} to sync`);
        return;
      }
      
      // For each table, check if it has any active sessions
      for (const table of allTables) {
        try {
          const activeSessions = await db
            .select()
            .from(tableSessions)
            .where(
              and(
                eq(tableSessions.tableId, table.id),
                eq(tableSessions.restaurantId, restaurantId),
                inArray(tableSessions.status, ['active', 'waiting'])
              )
            );
          
          const isOccupied = activeSessions.length > 0;
          
          // Only update if the status has changed
          if (table.isOccupied !== isOccupied) {
            await db
              .update(tables)
              .set({ 
                isOccupied, 
                updatedAt: new Date() 
              })
              .where(eq(tables.id, table.id));
            
            console.log(`[Storage] Updated table ${table.number} occupied status to ${isOccupied}`);
          }
        } catch (error) {
          console.error(`[Storage] Error updating table ${table.id} status:`, error);
          // Continue with other tables even if one fails
        }
      }
    } catch (error) {
      console.error(`[Storage] Error syncing table occupancy for restaurant ${restaurantId}:`, error);
    }
  }

  async getOrdersByCustomerId(customerId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerId, customerId));
  }

  async getOrdersByTableSessionId(tableSessionId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.tableSessionId, tableSessionId));
  }

  async cleanupEmptySessions(timeoutMinutes: number = 30): Promise<{ removedSessions: number, removedCustomers: number }> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - timeoutMinutes * 60000);
    
    let removedSessions = 0;
    let removedCustomers = 0;

    try {
      // Get all sessions that are older than the timeout and are in waiting/active status
      const oldSessions = await db
        .select()
        .from(tableSessions)
        .where(
          and(
            inArray(tableSessions.status, ['waiting', 'active']),
            lt(tableSessions.createdAt, cutoffTime)
          )
        );

      if (oldSessions.length === 0) {
        return { removedSessions: 0, removedCustomers: 0 };
      }

      const sessionIds = oldSessions.map(s => s.id);

      // Get all orders for these sessions in one query
      const sessionOrders = await db
        .select({ tableSessionId: orders.tableSessionId })
        .from(orders)
        .where(inArray(orders.tableSessionId, sessionIds));

      // Create a set of session IDs that have orders
      const sessionsWithOrders = new Set(sessionOrders.map(o => o.tableSessionId));

      // Separate sessions into those with orders and those without
      const sessionsToDelete = oldSessions.filter(s => !sessionsWithOrders.has(s.id));
      const sessionsToClean = oldSessions.filter(s => sessionsWithOrders.has(s.id));

      // Delete sessions that have no orders (and their customers)
      if (sessionsToDelete.length > 0) {
        const sessionsToDeleteIds = sessionsToDelete.map(s => s.id);
        
        // Delete customers for these sessions
        const deletedCustomers = await db
          .delete(customers)
          .where(inArray(customers.tableSessionId, sessionsToDeleteIds))
          .returning();
        
        removedCustomers += deletedCustomers.length;

        // Delete the sessions
        await db
          .delete(tableSessions)
          .where(inArray(tableSessions.id, sessionsToDeleteIds));
        
        removedSessions += sessionsToDeleteIds.length;
      }

      // For sessions with orders, remove ghost customers (customers with no orders)
      if (sessionsToClean.length > 0) {
        const sessionsToCleanIds = sessionsToClean.map(s => s.id);
        
        // Get all customers for these sessions
        const sessionCustomers = await db
          .select()
          .from(customers)
          .where(inArray(customers.tableSessionId, sessionsToCleanIds));

        if (sessionCustomers.length > 0) {
          const customerIds = sessionCustomers.map(c => c.id);
          
          // Get all orders for these customers
          const customerOrders = await db
            .select({ customerId: orders.customerId })
            .from(orders)
            .where(inArray(orders.customerId, customerIds));

          // Create a set of customer IDs that have orders
          const customersWithOrders = new Set(customerOrders.map(o => o.customerId));

          // Find customers without orders
          const ghostCustomerIds = customerIds.filter(id => !customersWithOrders.has(id));

          if (ghostCustomerIds.length > 0) {
            // Delete ghost customers
            await db
              .delete(customers)
              .where(inArray(customers.id, ghostCustomerIds));
            
            removedCustomers += ghostCustomerIds.length;
          }
        }
      }

      return { removedSessions, removedCustomers };
    } catch (error) {
      console.error('[Storage] Error during session cleanup:', error);
      return { removedSessions: 0, removedCustomers: 0 };
    }
  }

  // Mock menu items for test restaurant
  async getMenuItems(restaurantId: number): Promise<MenuItem[]> {
    // Fetch menu items from the database for the given restaurant
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  // Fetch menu items by array of IDs
  async getMenuItemsByIds(menuItemIds: number[]): Promise<MenuItem[]> {
    if (!menuItemIds.length) return [];
    
    return db
      .select()
      .from(menuItems)
      .where(inArray(menuItems.id, menuItemIds));
  }

  // Log or update a chat session for a restaurant
  async logAiChatSession({ restaurantId, userId, sessionId }: { restaurantId: number, userId?: number, sessionId?: string }): Promise<number | undefined> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Try to find an existing session in the last 24h for this restaurant/user/session
    const result = await db.execute(
      sql`SELECT id FROM ai_chat_sessions WHERE restaurant_id = ${restaurantId} AND (user_id = ${userId ?? null} OR session_id = ${sessionId ?? null}) AND last_message_at > ${since} ORDER BY last_message_at DESC LIMIT 1`
    );
    const existing = Array.isArray(result) && result[0] && typeof result[0].id === 'number' ? result[0] : undefined;
    if (existing && existing.id) {
      await db.execute(
        sql`UPDATE ai_chat_sessions SET last_message_at = NOW(), message_count = message_count + 1 WHERE id = ${existing.id}`
      );
      return existing.id as number;
    } else {
      const insertResult = await db.execute(
        sql`INSERT INTO ai_chat_sessions (restaurant_id, user_id, session_id, created_at, last_message_at, message_count) VALUES (${restaurantId}, ${userId ?? null}, ${sessionId ?? null}, NOW(), NOW(), 1) RETURNING id`
      );
      if (Array.isArray(insertResult) && insertResult[0] && typeof insertResult[0].id === 'number') {
        return insertResult[0].id as number;
      }
      return undefined;
    }
  }

  // Count unique chat sessions for a restaurant in the last 24h
  async countAiChatSessionsLast24h(restaurantId: number): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM ai_chat_sessions WHERE restaurant_id = ${restaurantId} AND last_message_at > ${since}`
    );
    if (Array.isArray(result) && result[0] && typeof result[0].count === 'number') {
      return result[0].count;
    }
    if (Array.isArray(result) && result[0] && typeof result[0].count === 'string') {
      // Some drivers may return count as string
      return parseInt(result[0].count, 10) || 0;
    }
    return 0;
  }
}

export const storage = new DatabaseStorage();
