import { z } from 'zod';

// Common validation schemas that can be shared between client and server

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

// Order schemas
export const orderStatusSchema = z.enum(['pending', 'confirmed', 'preparing', 'served', 'completed', 'cancelled']);

export const orderItemSchema = z.object({
  menuItemId: z.number(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format')
});

export const orderSchema = z.object({
  id: z.number(),
  customerName: z.string(),
  status: orderStatusSchema,
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid total format'),
  restaurantId: z.number(),
  tableId: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(orderItemSchema).optional()
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  tableId: z.number(),
  restaurantId: z.number(),
  status: orderStatusSchema,
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid total format'),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item')
});

export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  items: z.array(orderItemSchema).optional()
});

// Bill schemas
export const billSchema = z.object({
  billNumber: z.string().optional(),
  tableSessionId: z.number(),
  customerId: z.number().nullable(),
  type: z.enum(['individual', 'combined', 'partial']),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid subtotal format'),
  tax: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid tax format').optional(),
  tip: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid tip format').optional(),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid total format'),
  paymentMethod: z.enum(['cash', 'card', 'digital', 'split']).optional(),
  status: z.enum(['pending', 'paid', 'cancelled']).optional()
});

export const updateBillSchema = z.object({
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'digital', 'split']).optional(),
  tip: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid tip format').optional()
});

// Table session schemas
export const createTableSessionSchema = z.object({
  tableId: z.number(),
  restaurantId: z.number(),
  sessionName: z.string().optional(),
  partySize: z.number().int().positive('Party size must be positive'),
  status: z.enum(['waiting', 'active', 'completed', 'cancelled']).optional(),
  splitType: z.enum(['individual', 'combined', 'custom']).optional()
});

export const updateTableSessionSchema = z.object({
  sessionName: z.string().optional(),
  status: z.enum(['waiting', 'active', 'completed', 'cancelled']).optional(),
  endTime: z.string().optional(),
  splitType: z.enum(['individual', 'combined', 'custom']).optional()
});

// Customer schemas
export const customerSchema = z.object({
  tableSessionId: z.number(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').nullable().optional(),
  phone: z.string().nullable().optional(),
  isMainCustomer: z.boolean().optional()
});

// Feedback schemas
export const feedbackSchema = z.object({
  restaurantId: z.number(),
  orderId: z.number().optional(),
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional(),
  customerName: z.string().optional()
});

// Date range schema for analytics
export const dateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string()
});

// Helper function to validate data against a schema
export function validateData<T>(schema: z.ZodType<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  errors?: { path: string; message: string }[] 
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  } else {
    return {
      success: false,
      errors: result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }))
    };
  }
} 