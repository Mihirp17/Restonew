import { pgTable, text, integer, boolean, timestamp, decimal, jsonb, foreignKey, serial, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Platform Admin Model
export const platformAdmins = pgTable("platform_admins", {
  id: serial("id").primaryKey().notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  emailIdx: index("platform_admins_email_idx").on(table.email)
}));

// Restaurant Model
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logo: text("logo"),
  address: text("address"),
  phone: text("phone"),
  email: text("email").notNull(),
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  emailIdx: index("restaurants_email_idx").on(table.email),
  slugIdx: index("restaurants_slug_idx").on(table.slug),
  isActiveIdx: index("restaurants_is_active_idx").on(table.isActive)
}));

// Subscription Model
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey().notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  status: text("status").notNull(), // active, canceled, past_due
  plan: text("plan").notNull(), // basic, premium
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("subscriptions_restaurant_id_idx").on(table.restaurantId),
  statusIdx: index("subscriptions_status_idx").on(table.status)
}));

// Table Group Model - Enhanced for large parties (defined first to avoid circular reference)
export const tableGroups = pgTable("table_groups", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  description: text("description"), // Optional description for the group
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  totalCapacity: integer("total_capacity").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("table_groups_restaurant_id_idx").on(table.restaurantId)
}));

// Table Model - Enhanced for grouping
export const tables = pgTable("tables", {
  id: serial("id").primaryKey().notNull(),
  number: integer("number").notNull(),
  qrCode: text("qr_code").notNull().unique(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  isOccupied: boolean("is_occupied").default(false).notNull(),
  groupId: integer("group_id").references(() => tableGroups.id), // For grouped tables
  capacity: integer("capacity").default(4).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("tables_restaurant_id_idx").on(table.restaurantId),
  isOccupiedIdx: index("tables_is_occupied_idx").on(table.isOccupied),
  numberIdx: index("tables_number_idx").on(table.number),
  uniqueTableNumber: unique("unique_table_number_per_restaurant").on(table.number, table.restaurantId)
}));

// Table Session Model - Represents a dining session for a table/group
export const tableSessions = pgTable("table_sessions", {
  id: serial("id").primaryKey().notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  tableId: integer("table_id").notNull().references(() => tables.id),
  groupId: integer("group_id").references(() => tableGroups.id), // For grouped tables
  sessionName: text("session_name"), // Optional name for the session
  partySize: integer("party_size").notNull(),
  status: text("status").default("waiting").notNull(), // waiting, active, bill_requested, completed, abandoned
  startTime: timestamp("start_time").defaultNow().notNull(),
  firstOrderTime: timestamp("first_order_time"), // When session became active (first order placed)
  endTime: timestamp("end_time"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  billRequested: boolean("bill_requested").default(false).notNull(),
  billRequestedAt: timestamp("bill_requested_at"),
  splitType: text("split_type").default("individual").notNull(), // individual, split_evenly, combined
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("table_sessions_restaurant_id_idx").on(table.restaurantId),
  tableIdIdx: index("table_sessions_table_id_idx").on(table.tableId),
  statusIdx: index("table_sessions_status_idx").on(table.status),
  createdAtIdx: index("table_sessions_created_at_idx").on(table.createdAt)
}));

// Customer Model - For individual customers in a group
export const customers = pgTable("customers", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  tableSessionId: integer("table_session_id").notNull().references(() => tableSessions.id),
  isMainCustomer: boolean("is_main_customer").default(false).notNull(), // The person who made the reservation
  paymentStatus: text("payment_status").default("pending").notNull(), // pending, paid, partial
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  tableSessionIdIdx: index("customers_table_session_id_idx").on(table.tableSessionId),
  paymentStatusIdx: index("customers_payment_status_idx").on(table.paymentStatus)
}));

// Menu Item Model
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey().notNull(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  nameEs: text("name_es"),
  nameCa: text("name_ca"),
  description: text("description"),
  descriptionEn: text("description_en"),
  descriptionEs: text("description_es"),
  descriptionCa: text("description_ca"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  image: text("image"),
  category: text("category"),
  categoryEn: text("category_en"),
  categoryEs: text("category_es"),
  categoryCa: text("category_ca"),
  isAvailable: boolean("is_available").default(true).notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("menu_items_restaurant_id_idx").on(table.restaurantId),
  categoryIdx: index("menu_items_category_idx").on(table.category),
  isAvailableIdx: index("menu_items_is_available_idx").on(table.isAvailable)
}));

// Order Model - Enhanced for split billing
export const orders = pgTable("orders", {
  id: serial("id").primaryKey().notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  tableSessionId: integer("table_session_id").notNull().references(() => tableSessions.id),
  orderNumber: text("order_number").notNull().unique(), // Display-friendly order number
  status: text("status").notNull(), // pending, confirmed, preparing, served, completed, cancelled
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  tableId: integer("table_id").notNull().references(() => tables.id),
  notes: text("notes"), // Special requests or dietary notes
  isGroupOrder: boolean("is_group_order").default(false).notNull(), // If this order represents multiple people
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("orders_restaurant_id_idx").on(table.restaurantId),
  statusIdx: index("orders_status_idx").on(table.status),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  tableSessionIdIdx: index("orders_table_session_id_idx").on(table.tableSessionId),
  customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
  // Compound index for analytics queries
  restaurantStatusCreatedIdx: index("orders_restaurant_status_created_idx").on(table.restaurantId, table.status, table.createdAt)
}));

// Order Item Model
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey().notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
  customizations: text("customizations"), // Special requests for this item
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
  menuItemIdIdx: index("order_items_menu_item_id_idx").on(table.menuItemId)
}));

// Bill Model - For individual and combined bills
export const bills = pgTable("bills", {
  id: serial("id").primaryKey().notNull(),
  billNumber: text("bill_number").notNull().unique(),
  tableSessionId: integer("table_session_id").notNull().references(() => tableSessions.id),
  customerId: integer("customer_id").references(() => customers.id), // Null for combined bills
  type: text("type").notNull(), // individual, combined, partial
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00").notNull(),
  tip: decimal("tip", { precision: 10, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending, paid, cancelled
  paymentMethod: text("payment_method"), // cash, card, digital, split
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  // Unique constraint: only one bill per customer per table session
  uniqueCustomerSessionBill: unique("unique_customer_session_bill").on(table.customerId, table.tableSessionId),
  tableSessionIdIdx: index("bills_table_session_id_idx").on(table.tableSessionId),
  statusIdx: index("bills_status_idx").on(table.status),
  createdAtIdx: index("bills_created_at_idx").on(table.createdAt)
}));

// Bill Item Model - Items included in each bill
export const billItems = pgTable("bill_items", {
  id: serial("id").primaryKey().notNull(),
  billId: integer("bill_id").notNull().references(() => bills.id),
  orderItemId: integer("order_item_id").notNull().references(() => orderItems.id),
  quantity: integer("quantity").notNull(), // In case of partial items
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  billIdIdx: index("bill_items_bill_id_idx").on(table.billId),
  orderItemIdIdx: index("bill_items_order_item_id_idx").on(table.orderItemId)
}));

// User Model
export const users = pgTable("users", {
  id: serial("id").primaryKey().notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  first_name: text("first_name"),
  last_name: text("last_name"),
  profile_image_url: text("profile_image_url"),
  role: text("role").notNull(), // admin or manager
  is_active: boolean("is_active").default(true).notNull(),
  last_login: timestamp("last_login"),
  restaurantId: integer("restaurant_id").references(() => restaurants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
  restaurantIdIdx: index("users_restaurant_id_idx").on(table.restaurantId),
  roleIdx: index("users_role_idx").on(table.role)
}));

// Feedback Model
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey().notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  tableId: integer("table_id").notNull().references(() => tables.id),
  userId: integer("user_id").references(() => users.id), // For staff feedback
  customerId: integer("customer_id").references(() => customers.id), // For customer feedback
  tableSessionId: integer("table_session_id").references(() => tableSessions.id),
  feedbackType: text("feedback_type").default("customer").notNull(), // customer, staff
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("feedback_restaurant_id_idx").on(table.restaurantId),
  ratingIdx: index("feedback_rating_idx").on(table.rating),
  createdAtIdx: index("feedback_created_at_idx").on(table.createdAt)
}));

// Guest Session Model - Kept for backward compatibility
export const guestSessions = pgTable("guest_sessions", {
  id: text("id").primaryKey().notNull(),
  guestName: text("guest_name"),
  tableId: integer("table_id").notNull().references(() => tables.id),
  groupId: integer("group_id").references(() => tableGroups.id),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  language: text("language").default("en").notNull(),
  dietaryPreferences: text("dietary_preferences"),
  isActive: boolean("is_active").default(true).notNull(),
  arrivalTime: timestamp("arrival_time").defaultNow().notNull(),
  checkoutTime: timestamp("checkout_time"),
  paymentStatus: text("payment_status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("guest_sessions_restaurant_id_idx").on(table.restaurantId),
  tableIdIdx: index("guest_sessions_table_id_idx").on(table.tableId),
  isActiveIdx: index("guest_sessions_is_active_idx").on(table.isActive)
}));

// AI Insight Model
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey().notNull(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendations: jsonb("recommendations"),
  dataSource: jsonb("data_source"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  priority: text("priority").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  implementationStatus: text("implementation_status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  restaurantIdIdx: index("ai_insights_restaurant_id_idx").on(table.restaurantId),
  typeIdx: index("ai_insights_type_idx").on(table.type),
  priorityIdx: index("ai_insights_priority_idx").on(table.priority),
  isReadIdx: index("ai_insights_is_read_idx").on(table.isRead)
}));

// Add foreign key constraints to table groups for current session
export const tableGroupConstraints = pgTable("table_group_constraints", {
  id: serial("id").primaryKey().notNull(),
  tableGroupId: integer("table_group_id").notNull().references(() => tableGroups.id),
  currentSessionId: integer("current_session_id").references(() => tableSessions.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Add foreign key constraints for bill requested by customer
export const tableSessionConstraints = pgTable("table_session_constraints", {
  id: serial("id").primaryKey().notNull(),
  tableSessionId: integer("table_session_id").notNull().references(() => tableSessions.id),
  billRequestedBy: integer("bill_requested_by").references(() => customers.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Insert Schemas
export const insertPlatformAdminSchema = createInsertSchema(platformAdmins).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRestaurantSchema = createInsertSchema(restaurants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTableGroupSchema = createInsertSchema(tableGroups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTableSchema = createInsertSchema(tables).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTableSessionSchema = createInsertSchema(tableSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBillSchema = createInsertSchema(bills).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBillItemSchema = createInsertSchema(billItems).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGuestSessionSchema = createInsertSchema(guestSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({ id: true, createdAt: true, updatedAt: true });

// Select Types
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type TableGroup = typeof tableGroups.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type TableSession = typeof tableSessions.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type BillItem = typeof billItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type GuestSession = typeof guestSessions.$inferSelect;
export type AiInsight = typeof aiInsights.$inferSelect;

// Insert Types
export type InsertPlatformAdmin = z.infer<typeof insertPlatformAdminSchema>;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertTableGroup = z.infer<typeof insertTableGroupSchema>;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type InsertTableSession = z.infer<typeof insertTableSessionSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type InsertBillItem = z.infer<typeof insertBillItemSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertGuestSession = z.infer<typeof insertGuestSessionSchema>;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;

// Extended types for UI components
export interface CustomerWithOrders extends Customer {
  orders: Order[];
  totalAmount: number;
  billStatus: string;
}

export interface TableSessionWithDetails extends TableSession {
  customers: CustomerWithOrders[];
  table: Table;
  group?: TableGroup;
  orders: Order[];
  bills: Bill[];
}

export interface GroupOrderSummary {
  sessionId: number;
  tableName: string;
  customers: CustomerWithOrders[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  billRequested: boolean;
  canRequestBill: boolean;
}
