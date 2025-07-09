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
  type Bill, type InsertBill, bills
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
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
  getOrdersByRestaurantId(restaurantId: number): Promise<Order[]>;
  getActiveOrdersByRestaurantId(restaurantId: number, limit?: number): Promise<Order[]>;
  getActiveOrdersLightweight(restaurantId: number, limit?: number): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName?: string, tableNumber?: number}[]>;
  getActiveOrdersThin(restaurantId: number, limit?: number): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName: string, tableNumber: number}[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;
  
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
  getFeedbackByRestaurantId(restaurantId: number): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;

  // Analytics Methods
  getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getPopularMenuItems(restaurantId: number, limit: number): Promise<{id: number, name: string, count: number, price: string}[]>;
  
  // Payment related helpers (Stripe removed)
  // updateRestaurantStripeInfo removed - placeholder implementation
  
  // AI Insights methods
  getAiInsightsByRestaurantId(restaurantId: number): Promise<any[]>;
  createAiInsight(insight: any): Promise<any>;
  updateAiInsight(insightId: number, updates: any): Promise<any>;
  markAiInsightAsRead(insightId: number): Promise<boolean>;
  updateAiInsightStatus(insightId: number, status: string): Promise<boolean>;

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
  getBillsByRestaurantId(restaurantId: number, status?: string): Promise<Bill[]>;
  getBillsByTableSessionId(tableSessionId: number): Promise<Bill[]>;
  getBillByCustomerAndSession(customerId: number, tableSessionId: number): Promise<Bill | undefined>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined>;
  checkAllCustomersBillsPaid(tableSessionId: number): Promise<boolean>;
  updateSessionPaymentProgress(tableSessionId: number): Promise<void>;
  calculateSessionTotals(tableSessionId: number): Promise<void>;
  invalidateSessionCache(tableSessionId: number): Promise<void>;
  syncTableOccupancy(restaurantId: number): Promise<void>;

  // Mock menu items for test restaurant
  getMenuItems(restaurantId: number): Promise<MenuItem[]>;
}

// Mock menu items for test restaurant
const mockMenuItems = [
  {
    id: 1,
    name: "Classic Margherita",
    description: "Fresh tomatoes, mozzarella, basil, and olive oil",
    price: "12.99",
    category: "Pizza",
    isAvailable: true,
    image: null
  },
  {
    id: 2,
    name: "Pepperoni Feast",
    description: "Loaded with pepperoni and extra cheese",
    price: "14.99",
    category: "Pizza",
    isAvailable: true,
    image: null
  },
  {
    id: 3,
    name: "Garlic Bread",
    description: "Toasted bread with garlic butter and herbs",
    price: "5.99",
    category: "Starters",
    isAvailable: true,
    image: null
  },
  {
    id: 4,
    name: "Caesar Salad",
    description: "Fresh romaine lettuce, croutons, parmesan, and Caesar dressing",
    price: "8.99",
    category: "Starters",
    isAvailable: true,
    image: null
  },
  {
    id: 5,
    name: "Spaghetti Bolognese",
    description: "Classic pasta with meat sauce and parmesan",
    price: "13.99",
    category: "Pasta",
    isAvailable: true,
    image: null
  },
  {
    id: 6,
    name: "Fettuccine Alfredo",
    description: "Creamy parmesan sauce with garlic and herbs",
    price: "12.99",
    category: "Pasta",
    isAvailable: true,
    image: null
  },
  {
    id: 7,
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with a molten center, served with vanilla ice cream",
    price: "7.99",
    category: "Desserts",
    isAvailable: true,
    image: null
  },
  {
    id: 8,
    name: "Tiramisu",
    description: "Classic Italian dessert with coffee-soaked ladyfingers and mascarpone cream",
    price: "6.99",
    category: "Desserts",
    isAvailable: true,
    image: null
  },
  {
    id: 9,
    name: "Soft Drinks",
    description: "Choice of Coke, Sprite, Fanta, or Diet Coke",
    price: "2.99",
    category: "Drinks",
    isAvailable: true,
    image: null
  },
  {
    id: 10,
    name: "Fresh Lemonade",
    description: "Homemade lemonade with mint",
    price: "3.99",
    category: "Drinks",
    isAvailable: true,
    image: null
  }
];

export class DatabaseStorage implements IStorage {
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

  async getOrdersByRestaurantId(restaurantId: number): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId))
      .orderBy(desc(orders.createdAt));
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

  async getActiveOrdersLightweight(restaurantId: number, limit?: number): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName?: string, tableNumber?: number}[]> {
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
        customerName: row.customerName ? String(row.customerName) : undefined,
        tableNumber: row.tableNumber ? Number(row.tableNumber) : undefined
      }));
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

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    
    // Invalidate session cache when new order is created
    if (newOrder.tableSessionId) {
      await this.invalidateSessionCache(newOrder.tableSessionId);
    }
    
    return newOrder;
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

  async getFeedbackByRestaurantId(restaurantId: number): Promise<Feedback[]> {
    return await db.select().from(feedback).where(eq(feedback.restaurantId, restaurantId));
  }

  async createFeedback(feedbackItem: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values(feedbackItem)
      .returning();
    return newFeedback;
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

  async getPopularMenuItems(restaurantId: number, limit: number): Promise<{id: number, name: string, count: number, price: string}[]> {
    try {
      const result = await db.select({
        id: menuItems.id,
        name: menuItems.name,
        price: menuItems.price,
        count: sql<number>`COUNT(${orderItems.id})::integer`
      })
      .from(menuItems)
      .leftJoin(orderItems, sql`${menuItems.id} = ${orderItems.menuItemId}`)
      .leftJoin(orders, sql`${orderItems.orderId} = ${orders.id} AND ${orders.status} != 'cancelled'`)
      .where(eq(menuItems.restaurantId, restaurantId))
      .groupBy(menuItems.id, menuItems.name, menuItems.price)
      .orderBy(desc(sql`COUNT(${orderItems.id})`))
      .limit(limit);
      
      return result.map(row => ({
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
  async getAiInsightsByRestaurantId(restaurantId: number): Promise<any[]> {
    try {
      const result = await db.select().from(aiInsights).where(eq(aiInsights.restaurantId, restaurantId));
      return result;
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      return [];
    }
  }

  async createAiInsight(insight: any): Promise<any> {
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

  async updateAiInsight(insightId: number, updates: any): Promise<any> {
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

  async markAiInsightAsRead(insightId: number): Promise<boolean> {
    try {
      const result = await db
        .update(aiInsights)
        .set({ isRead: true, updatedAt: new Date() })
        .where(eq(aiInsights.id, insightId))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error marking AI insight as read:', error);
      return false;
    }
  }

  async updateAiInsightStatus(insightId: number, status: string): Promise<boolean> {
    try {
      const result = await db
        .update(aiInsights)
        .set({ implementationStatus: status, updatedAt: new Date() })
        .where(eq(aiInsights.id, insightId))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error updating AI insight status:', error);
      return false;
    }
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
    const [newSession] = await db
      .insert(tableSessions)
      .values(session)
      .returning();
    return newSession;
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

    const [updatedSession] = await db
      .update(tableSessions)
      .set({ ...sanitizedSession, updatedAt: new Date() })
      .where(eq(tableSessions.id, id))
      .returning();
    return updatedSession;
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
    const [newCustomer] = await db
      .insert(customers)
      .values(customer)
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

  async getBillsByTableSessionId(tableSessionId: number): Promise<Bill[]> {
    return await db.select().from(bills).where(eq(bills.tableSessionId, tableSessionId));
  }

  async getBillByCustomerAndSession(customerId: number, tableSessionId: number): Promise<Bill | undefined> {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.customerId, customerId), eq(bills.tableSessionId, tableSessionId)));
    return bill;
  }

  async createBill(bill: InsertBill): Promise<Bill> {
    const [newBill] = await db
      .insert(bills)
      .values(bill)
      .returning();
    return newBill;
  }

  async updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined> {
    const [updatedBill] = await db
      .update(bills)
      .set({ ...bill, updatedAt: new Date() })
      .where(eq(bills.id, id))
      .returning();
    
    // Invalidate session cache when bill is updated
    if (updatedBill?.tableSessionId) {
      await this.invalidateSessionCache(updatedBill.tableSessionId);
    }
    
    // If bill status is changed to 'paid', update customer payment status
    if (bill.status === 'paid' && updatedBill?.customerId) {
      await this.updateCustomer(updatedBill.customerId, { paymentStatus: 'paid' });
      
      // Check if all customers have paid and update session accordingly
      await this.updateSessionPaymentProgress(updatedBill.tableSessionId);
    }
    
    return updatedBill;
  }

  async checkAllCustomersBillsPaid(tableSessionId: number): Promise<boolean> {
    // Get all customers in the session
    const customers = await this.getCustomersByTableSessionId(tableSessionId);
    
    // Get all bills for the session
    const sessionBills = await this.getBillsByTableSessionId(tableSessionId);
    
    // Check if every customer has a paid bill
    for (const customer of customers) {
      const customerBill = sessionBills.find(bill => bill.customerId === customer.id);
      if (!customerBill || customerBill.status !== 'paid') {
        return false;
      }
    }
    
    return customers.length > 0; // At least one customer must exist
  }

  async updateSessionPaymentProgress(tableSessionId: number): Promise<void> {
    const allPaid = await this.checkAllCustomersBillsPaid(tableSessionId);
    
    if (allPaid) {
      // Mark session as completed and set end time
      await this.updateTableSession(tableSessionId, {
        status: 'completed',
        endTime: new Date()
      });
      
      // Get session to sync table occupancy for the restaurant
      const session = await this.getTableSession(tableSessionId);
      if (session?.restaurantId) {
        await this.syncTableOccupancy(session.restaurantId);
      }
    } else {
      // Calculate session totals from actual orders and bills
      await this.calculateSessionTotals(tableSessionId);
    }
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

    // Get all orders for this session with a single optimized query
    const sessionOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.tableSessionId, tableSessionId));
    
    // Calculate total from orders
    const orderTotal = sessionOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    
    // Get bills for payment calculation with single query
    const sessionBills = await this.getBillsByTableSessionId(tableSessionId);
    
    const paidAmount = sessionBills
      .filter(bill => bill.status === 'paid')
      .reduce((sum, bill) => sum + parseFloat(bill.total), 0);
    
    const totals = {
      totalAmount: orderTotal.toString(),
      paidAmount: paidAmount.toString()
    };

    // Update session with accurate totals only if changed
    const currentSession = await this.getTableSession(tableSessionId);
    if (!currentSession || 
        currentSession.totalAmount !== totals.totalAmount || 
        currentSession.paidAmount !== totals.paidAmount) {
      
      await this.updateTableSession(tableSessionId, totals);
      console.log(`[Storage] Updated session ${tableSessionId} totals: ${totals.totalAmount} total, ${totals.paidAmount} paid`);
    }

    // Cache the result
    this.sessionTotalsCache.set(tableSessionId, {
      totals,
      lastUpdated: now
    });
  }

  // Method to invalidate session cache when orders/bills change
  async invalidateSessionCache(tableSessionId: number): Promise<void> {
    this.sessionTotalsCache.delete(tableSessionId);
    console.log(`[Storage] Invalidated cache for session ${tableSessionId}`);
  }

  async syncTableOccupancy(restaurantId: number): Promise<void> {
    // Get all tables for this restaurant
    const restaurantTables = await db
      .select()
      .from(tables)
      .where(eq(tables.restaurantId, restaurantId));

    // Get all active sessions for this restaurant
    const activeSessions = await this.getTableSessionsByRestaurantId(restaurantId, 'active');
    const occupiedTableIds = new Set(activeSessions.map(session => session.tableId));

    // Update each table's occupancy status
    for (const table of restaurantTables) {
      const shouldBeOccupied = occupiedTableIds.has(table.id);
      
      if (table.isOccupied !== shouldBeOccupied) {
        await this.updateTable(table.id, { isOccupied: shouldBeOccupied });
      }
    }
  }

  // Mock menu items for test restaurant
  async getMenuItems(restaurantId: number): Promise<MenuItem[]> {
    // Fetch menu items from the database for the given restaurant
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }
}

export const storage = new DatabaseStorage();
