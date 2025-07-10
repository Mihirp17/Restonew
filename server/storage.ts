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
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import bcrypt from 'bcryptjs';
import { 
  restaurantCache, menuCache, orderCache, analyticsCache, aiCache,
  cacheKeys, withCache, invalidateRestaurantCache, invalidateMenuCache,
  invalidateOrderCache, invalidateAnalyticsCache, invalidateAiCache
} from './cache.js';

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

  // Analytics Methods
  getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number>;
  getPopularMenuItems(restaurantId: number, limit: number, options?: { startDate?: Date, endDate?: Date }): Promise<{id: number, name: string, count: number, price: string}[]>;
  
  // AI Insights methods
  getAiInsightsByRestaurantId(restaurantId: number): Promise<any[]>;
  createAiInsight(insight: any): Promise<any>;
  updateAiInsight(insightId: number, updates: any): Promise<any>;
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
  getBillsByTableSessionId(tableSessionId: number, limit?: number, offset?: number): Promise<Bill[]>;
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

  // Log or update a chat session for a restaurant
  logAiChatSession(params: { restaurantId: number, userId?: number, sessionId?: string }): Promise<number | undefined>;

  // Count unique chat sessions for a restaurant in the last 24h
  countAiChatSessionsLast24h(restaurantId: number): Promise<number>;
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
    price: "8.99",
    category: "Desserts",
    isAvailable: true,
    image: null
  }
];

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaultAdmin();
  }

  private async initializeDefaultAdmin() {
    try {
      const existingAdmin = await this.getPlatformAdminByEmail('admin@restomate.com');
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 12);
        await this.createPlatformAdmin({
          email: 'admin@restomate.com',
          password: hashedPassword,
          name: 'Platform Admin'
        });
        console.log('Default platform admin created');
      }
    } catch (error) {
      console.error('Error initializing default admin:', error);
    }
  }

  // Platform Admin Methods with caching
  async getPlatformAdmin(id: number): Promise<PlatformAdmin | undefined> {
    return await db.select().from(platformAdmins).where(eq(platformAdmins.id, id)).limit(1).then(res => res[0]);
  }

  async getPlatformAdminByEmail(email: string): Promise<PlatformAdmin | undefined> {
    return await db.select().from(platformAdmins).where(eq(platformAdmins.email, email)).limit(1).then(res => res[0]);
  }

  async createPlatformAdmin(admin: InsertPlatformAdmin): Promise<PlatformAdmin> {
    const result = await db.insert(platformAdmins).values(admin).returning();
    return result[0];
  }

  // Restaurant Methods with caching
  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    return await withCache(
      restaurantCache,
      cacheKeys.restaurant(id),
      async () => {
        return await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1).then(res => res[0]);
      }
    );
  }

  async getRestaurantByEmail(email: string): Promise<Restaurant | undefined> {
    return await db.select().from(restaurants).where(eq(restaurants.email, email)).limit(1).then(res => res[0]);
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    return await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1).then(res => res[0]);
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants).orderBy(desc(restaurants.createdAt));
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const result = await db.insert(restaurants).values(restaurant).returning();
    const newRestaurant = result[0];
    restaurantCache.set(cacheKeys.restaurant(newRestaurant.id), newRestaurant);
    return newRestaurant;
  }

  async updateRestaurant(id: number, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined> {
    const result = await db.update(restaurants)
      .set({ ...restaurant, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    
    if (result.length > 0) {
      const updatedRestaurant = result[0];
      restaurantCache.set(cacheKeys.restaurant(id), updatedRestaurant);
      return updatedRestaurant;
    }
    return undefined;
  }

  // Subscription Methods
  async getSubscription(id: number): Promise<Subscription | undefined> {
    return await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1).then(res => res[0]);
  }

  async getSubscriptionByRestaurantId(restaurantId: number): Promise<Subscription | undefined> {
    return await db.select().from(subscriptions).where(eq(subscriptions.restaurantId, restaurantId)).limit(1).then(res => res[0]);
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(subscription).returning();
    return result[0];
  }

  async updateSubscription(id: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const result = await db.update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return result[0];
  }

  async updateSubscriptionByRestaurantId(restaurantId: number, subscription: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const result = await db.update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.restaurantId, restaurantId))
      .returning();
    return result[0];
  }

  // Table Methods
  async getTable(id: number): Promise<Table | undefined> {
    return await db.select().from(tables).where(eq(tables.id, id)).limit(1).then(res => res[0]);
  }

  async getTablesByRestaurantId(restaurantId: number): Promise<Table[]> {
    return await db.select().from(tables).where(eq(tables.restaurantId, restaurantId)).orderBy(tables.number);
  }

  async createTable(table: InsertTable): Promise<Table> {
    const result = await db.insert(tables).values(table).returning();
    return result[0];
  }

  async updateTable(id: number, table: Partial<InsertTable>): Promise<Table | undefined> {
    const result = await db.update(tables)
      .set({ ...table, updatedAt: new Date() })
      .where(eq(tables.id, id))
      .returning();
    return result[0];
  }

  async deleteTable(id: number): Promise<boolean> {
    const result = await db.delete(tables).where(eq(tables.id, id));
    return result.rowCount > 0;
  }

  // MenuItem Methods with caching
  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    return await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1).then(res => res[0]);
  }

  async getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]> {
    return await withCache(
      menuCache,
      cacheKeys.menu(restaurantId),
      async () => {
        return await db.select().from(menuItems)
          .where(eq(menuItems.restaurantId, restaurantId))
          .orderBy(menuItems.category, menuItems.name);
      }
    );
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    const result = await db.insert(menuItems).values(menuItem).returning();
    const newMenuItem = result[0];
    invalidateMenuCache(menuItem.restaurantId);
    return newMenuItem;
  }

  async updateMenuItem(id: number, menuItem: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const result = await db.update(menuItems)
      .set({ ...menuItem, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    
    if (result.length > 0) {
      invalidateMenuCache(result[0].restaurantId);
      return result[0];
    }
    return undefined;
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    const item = await this.getMenuItem(id);
    if (!item) return false;
    
    const result = await db.delete(menuItems).where(eq(menuItems.id, id));
    if (result.rowCount > 0) {
      invalidateMenuCache(item.restaurantId);
      return true;
    }
    return false;
  }

  // Order Methods with caching and optimization
  async getOrder(id: number): Promise<Order | undefined> {
    return await db.select().from(orders).where(eq(orders.id, id)).limit(1).then(res => res[0]);
  }

  async getOrdersByRestaurantId(restaurantId: number, options: { startDate?: Date, endDate?: Date } = {}): Promise<Order[]> {
    const cacheKey = cacheKeys.orders(restaurantId, options.startDate?.toISOString() || 'all');
    
    return await withCache(
      orderCache,
      cacheKey,
      async () => {
        let query = db.select().from(orders).where(eq(orders.restaurantId, restaurantId));
        
        if (options.startDate || options.endDate) {
          const conditions = [];
          if (options.startDate) {
            conditions.push(gte(orders.createdAt, options.startDate));
          }
          if (options.endDate) {
            conditions.push(lte(orders.createdAt, options.endDate));
          }
          query = query.where(and(...conditions));
        }
        
        return await query.orderBy(desc(orders.createdAt));
      },
      1000 * 60 * 2 // 2 minutes cache for orders
    );
  }

  async getActiveOrdersByRestaurantId(restaurantId: number, limit: number = 50): Promise<Order[]> {
    const cacheKey = `active_orders:${restaurantId}:${limit}`;
    
    return await withCache(
      orderCache,
      cacheKey,
      async () => {
        return await db.select()
          .from(orders)
          .where(and(
            eq(orders.restaurantId, restaurantId),
            sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'served')`
          ))
          .orderBy(desc(orders.createdAt))
          .limit(limit);
      },
      1000 * 30 // 30 seconds cache for active orders
    );
  }

  async getActiveOrdersLightweight(restaurantId: number, limit: number = 20): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName?: string, tableNumber?: number}[]> {
    const cacheKey = `active_orders_light:${restaurantId}:${limit}`;
    
    return await withCache(
      orderCache,
      cacheKey,
      async () => {
        return await db.select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          total: orders.total,
          createdAt: orders.createdAt,
          customerName: customers.name,
          tableNumber: tables.number
        })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .leftJoin(tables, eq(orders.tableId, tables.id))
        .where(and(
          eq(orders.restaurantId, restaurantId),
          sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'served')`
        ))
        .orderBy(desc(orders.createdAt))
        .limit(limit);
      },
      1000 * 15 // 15 seconds cache for lightweight orders
    );
  }

  async getActiveOrdersThin(restaurantId: number, limit: number = 20): Promise<{id: number, orderNumber: string, status: string, total: string, createdAt: Date, customerName: string, tableNumber: number}[]> {
    const cacheKey = `active_orders_thin:${restaurantId}:${limit}`;
    
    return await withCache(
      orderCache,
      cacheKey,
      async () => {
        return await db.select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          total: orders.total,
          createdAt: orders.createdAt,
          customerName: customers.name,
          tableNumber: tables.number
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .innerJoin(tables, eq(orders.tableId, tables.id))
        .where(and(
          eq(orders.restaurantId, restaurantId),
          sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'served')`
        ))
        .orderBy(desc(orders.createdAt))
        .limit(limit);
      },
      1000 * 10 // 10 seconds cache for thin orders
    );
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    const newOrder = result[0];
    invalidateOrderCache(newOrder.restaurantId);
    return newOrder;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    
    if (result.length > 0) {
      invalidateOrderCache(result[0].restaurantId);
      return result[0];
    }
    return undefined;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const order = await this.getOrder(id);
    if (!order) return false;
    
    const result = await db.delete(orders).where(eq(orders.id, id));
    if (result.rowCount > 0) {
      invalidateOrderCache(order.restaurantId);
      return true;
    }
    return false;
  }

  // OrderItem Methods
  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    return await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1).then(res => res[0]);
  }

  async getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(orderItem).returning();
    return result[0];
  }

  async deleteOrderItemsByOrderId(orderId: number): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    return result.rowCount > 0;
  }

  async getOrderItemsByRestaurantId(restaurantId: number): Promise<{ orderItems: OrderItem, orders: Order }[]> {
    return await db.select({
      orderItems: orderItems,
      orders: orders
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orders.restaurantId, restaurantId));
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    return await db.select().from(users).where(eq(users.id, id)).limit(1).then(res => res[0]);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await db.select().from(users).where(eq(users.email, email)).limit(1).then(res => res[0]);
  }

  async deleteUserByEmail(email: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.email, email));
    return result.rowCount > 0;
  }

  async getUsersByRestaurantId(restaurantId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.restaurantId, restaurantId));
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 12);
    const result = await db.insert(users).values({ ...user, password: hashedPassword }).returning();
    return result[0];
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...user, updatedAt: new Date() };
    
    if (user.password) {
      updateData.password = await bcrypt.hash(user.password, 12);
    }
    
    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Feedback Methods
  async getFeedback(id: number): Promise<Feedback | undefined> {
    return await db.select().from(feedback).where(eq(feedback.id, id)).limit(1).then(res => res[0]);
  }

  async getFeedbackByRestaurantId(restaurantId: number, options: { startDate?: Date, endDate?: Date } = {}): Promise<Feedback[]> {
    let query = db.select().from(feedback).where(eq(feedback.restaurantId, restaurantId));
    
    if (options.startDate || options.endDate) {
      const conditions = [];
      if (options.startDate) {
        conditions.push(gte(feedback.createdAt, options.startDate));
      }
      if (options.endDate) {
        conditions.push(lte(feedback.createdAt, options.endDate));
      }
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(feedback.createdAt));
  }

  async createFeedback(feedbackItem: InsertFeedback): Promise<Feedback> {
    const result = await db.insert(feedback).values(feedbackItem).returning();
    return result[0];
  }

  // Analytics Methods with caching
  async getRestaurantRevenue(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    const cacheKey = `revenue:${restaurantId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    return await withCache(
      analyticsCache,
      cacheKey,
      async () => {
        const result = await db.select({
          total: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)`
        })
        .from(orders)
        .where(and(
          eq(orders.restaurantId, restaurantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ));
        
        return parseFloat(result[0]?.total?.toString() || '0');
      },
      1000 * 60 * 15 // 15 minutes cache for revenue data
    );
  }

  async getOrderCountByRestaurantId(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    const cacheKey = `order_count:${restaurantId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    return await withCache(
      analyticsCache,
      cacheKey,
      async () => {
        const result = await db.select({
          count: count()
        })
        .from(orders)
        .where(and(
          eq(orders.restaurantId, restaurantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ));
        
        return result[0]?.count || 0;
      },
      1000 * 60 * 15 // 15 minutes cache for order count
    );
  }

  async getAverageOrderValue(restaurantId: number, startDate: Date, endDate: Date): Promise<number> {
    const cacheKey = `avg_order_value:${restaurantId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    return await withCache(
      analyticsCache,
      cacheKey,
      async () => {
        const result = await db.select({
          average: sql<number>`COALESCE(AVG(${orders.total}::numeric), 0)`
        })
        .from(orders)
        .where(and(
          eq(orders.restaurantId, restaurantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ));
        
        return parseFloat(result[0]?.average?.toString() || '0');
      },
      1000 * 60 * 15 // 15 minutes cache for average order value
    );
  }

  async getPopularMenuItems(restaurantId: number, limit: number, options: { startDate?: Date, endDate?: Date } = {}): Promise<{id: number, name: string, count: number, price: string}[]> {
    const cacheKey = `popular_items:${restaurantId}:${limit}:${options.startDate?.toISOString() || 'all'}:${options.endDate?.toISOString() || 'all'}`;
    
    return await withCache(
      analyticsCache,
      cacheKey,
      async () => {
        // This is a simplified version - in a real implementation, you'd join with orderItems
        // For now, returning mock data based on menu items
        const items = await this.getMenuItems(restaurantId);
        return items.slice(0, limit).map((item, index) => ({
          id: item.id,
          name: item.name,
          count: Math.floor(Math.random() * 50) + 10, // Mock count
          price: item.price
        }));
      },
      1000 * 60 * 30 // 30 minutes cache for popular items
    );
  }

  // AI Insights methods with caching
  async getAiInsightsByRestaurantId(restaurantId: number): Promise<any[]> {
    return await withCache(
      aiCache,
      cacheKeys.aiInsights(restaurantId),
      async () => {
        return await db.select().from(aiInsights)
          .where(eq(aiInsights.restaurantId, restaurantId))
          .orderBy(desc(aiInsights.createdAt));
      }
    );
  }

  async createAiInsight(insight: any): Promise<any> {
    const result = await db.insert(aiInsights).values({
      ...insight,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    const newInsight = result[0];
    invalidateAiCache(newInsight.restaurantId);
    return newInsight;
  }

  async updateAiInsight(insightId: number, updates: any): Promise<any> {
    const result = await db.update(aiInsights)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiInsights.id, insightId))
      .returning();
    
    if (result.length > 0) {
      invalidateAiCache(result[0].restaurantId);
      return result[0];
    }
    return null;
  }

  async markAiInsightAsRead(insightId: number): Promise<void> {
    await this.updateAiInsight(insightId, { isRead: true });
  }

  async updateAiInsightStatus(insightId: number, status: string): Promise<void> {
    await this.updateAiInsight(insightId, { implementationStatus: status });
  }

  // Table Session Methods
  async getTableSession(id: number): Promise<TableSession | undefined> {
    return await db.select().from(tableSessions).where(eq(tableSessions.id, id)).limit(1).then(res => res[0]);
  }

  async getTableSessionsByRestaurantId(restaurantId: number, status?: string): Promise<any[]> {
    let query = db.select().from(tableSessions).where(eq(tableSessions.restaurantId, restaurantId));
    
    if (status) {
      query = query.where(eq(tableSessions.status, status));
    }
    
    return await query.orderBy(desc(tableSessions.createdAt));
  }

  async createTableSession(session: InsertTableSession): Promise<TableSession> {
    const result = await db.insert(tableSessions).values(session).returning();
    return result[0];
  }

  async updateTableSession(id: number, session: Partial<InsertTableSession>): Promise<TableSession | undefined> {
    const result = await db.update(tableSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(tableSessions.id, id))
      .returning();
    return result[0];
  }

  // Customer Methods
  async getCustomer(id: number): Promise<Customer | undefined> {
    return await db.select().from(customers).where(eq(customers.id, id)).limit(1).then(res => res[0]);
  }

  async getCustomersByTableSessionId(tableSessionId: number): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.tableSessionId, tableSessionId));
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return result[0];
  }

  // Bill Methods
  async getBill(id: number): Promise<Bill | undefined> {
    return await db.select().from(bills).where(eq(bills.id, id)).limit(1).then(res => res[0]);
  }

  async getBillsByRestaurantId(restaurantId: number, status?: string): Promise<any[]> {
    let query = db.select().from(bills).where(eq(bills.restaurantId, restaurantId));
    
    if (status) {
      query = query.where(eq(bills.status, status));
    }
    
    return await query.orderBy(desc(bills.createdAt));
  }

  async getBillsByTableSessionId(tableSessionId: number, limit: number = 30, offset: number = 0): Promise<Bill[]> {
    return await db.select().from(bills)
      .where(eq(bills.tableSessionId, tableSessionId))
      .orderBy(desc(bills.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getBillByCustomerAndSession(customerId: number, tableSessionId: number): Promise<Bill | undefined> {
    return await db.select().from(bills)
      .where(and(
        eq(bills.customerId, customerId),
        eq(bills.tableSessionId, tableSessionId)
      ))
      .limit(1)
      .then(res => res[0]);
  }

  async createBill(bill: InsertBill): Promise<Bill> {
    const result = await db.insert(bills).values(bill).returning();
    return result[0];
  }

  async updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined> {
    const result = await db.update(bills)
      .set({ ...bill, updatedAt: new Date() })
      .where(eq(bills.id, id))
      .returning();
    return result[0];
  }

  async checkAllCustomersBillsPaid(tableSessionId: number): Promise<boolean> {
    const customers = await this.getCustomersByTableSessionId(tableSessionId);
    const bills = await this.getBillsByTableSessionId(tableSessionId);
    
    return customers.every(customer => {
      const customerBill = bills.find(bill => bill.customerId === customer.id);
      return customerBill && customerBill.status === 'paid';
    });
  }

  async updateSessionPaymentProgress(tableSessionId: number): Promise<void> {
    const bills = await this.getBillsByTableSessionId(tableSessionId);
    const totalAmount = bills.reduce((sum, bill) => sum + parseFloat(bill.total), 0);
    const paidAmount = bills
      .filter(bill => bill.status === 'paid')
      .reduce((sum, bill) => sum + parseFloat(bill.total), 0);
    
    await this.updateTableSession(tableSessionId, {
      totalAmount: totalAmount.toString(),
      paidAmount: paidAmount.toString()
    });
  }

  // Session totals cache
  private sessionTotalsCache = new Map<number, { totals: { totalAmount: string, paidAmount: string }, lastUpdated: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache TTL

  async calculateSessionTotals(tableSessionId: number): Promise<void> {
    const now = Date.now();
    const cached = this.sessionTotalsCache.get(tableSessionId);
    
    if (cached && (now - cached.lastUpdated) < this.CACHE_TTL) {
      return; // Use cached data
    }

    try {
      const bills = await this.getBillsByTableSessionId(tableSessionId);
      
      const totals = bills.reduce((acc, bill) => {
        const amount = parseFloat(bill.total);
        acc.totalAmount += amount;
        if (bill.status === 'paid') {
          acc.paidAmount += amount;
        }
        return acc;
      }, { totalAmount: 0, paidAmount: 0 });

      // Update cache
      this.sessionTotalsCache.set(tableSessionId, {
        totals: {
          totalAmount: totals.totalAmount.toFixed(2),
          paidAmount: totals.paidAmount.toFixed(2)
        },
        lastUpdated: now
      });

      // Update session in database
      await this.updateTableSession(tableSessionId, {
        totalAmount: totals.totalAmount.toFixed(2),
        paidAmount: totals.paidAmount.toFixed(2)
      });

    } catch (error) {
      console.error('Error calculating session totals:', error);
      throw error;
    }
  }

  async invalidateSessionCache(tableSessionId: number): Promise<void> {
    this.sessionTotalsCache.delete(tableSessionId);
  }

  async syncTableOccupancy(restaurantId: number): Promise<void> {
    try {
      // Get all active table sessions
      const activeSessions = await this.getTableSessionsByRestaurantId(restaurantId, 'active');
      
      // Get all tables for this restaurant
      const tables = await this.getTablesByRestaurantId(restaurantId);
      
      // Update table occupancy based on active sessions
      for (const table of tables) {
        const hasActiveSession = activeSessions.some(session => session.tableId === table.id);
        if (table.isOccupied !== hasActiveSession) {
          await this.updateTable(table.id, { isOccupied: hasActiveSession });
        }
      }
    } catch (error) {
      console.error('Error syncing table occupancy:', error);
    }
  }

  async getOrdersByTableSessionId(tableSessionId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.tableSessionId, tableSessionId));
  }

  async getMenuItems(restaurantId: number): Promise<MenuItem[]> {
    // Return mock menu items for test restaurant
    if (restaurantId === 1) {
      return mockMenuItems;
    }
    
    return await this.getMenuItemsByRestaurantId(restaurantId);
  }

  async logAiChatSession({ restaurantId, userId, sessionId }: { restaurantId: number, userId?: number, sessionId?: string }): Promise<number | undefined> {
    try {
      // In a real implementation, you would log this to a database table
      // For now, we'll just return a mock session ID
      console.log(`AI Chat session logged: Restaurant ${restaurantId}, User ${userId}, Session ${sessionId}`);
      return Date.now();
    } catch (error) {
      console.error('Error logging AI chat session:', error);
      return undefined;
    }
  }

  async countAiChatSessionsLast24h(restaurantId: number): Promise<number> {
    try {
      // In a real implementation, you would query the database
      // For now, return a mock count
      return Math.floor(Math.random() * 10) + 1;
    } catch (error) {
      console.error('Error counting AI chat sessions:', error);
      return 0;
    }
  }
}

export const storage = new DatabaseStorage();
