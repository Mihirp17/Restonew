import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { storage } from './storage';
import { z } from 'zod';

// Create a memory store with an explicit limit
const SessionStore = MemoryStore(session);

// Session configuration
export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'my-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' as const
  },
  store: new SessionStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  })
};

// Auth types
export type UserRole = 'platform_admin' | 'restaurant' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: number;
}

// Input validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// Extend Express Request interface
declare module 'express-session' {
  interface SessionData {
    user: AuthUser;
  }
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ 
        message: 'You must be logged in to access this resource',
        code: 'AUTH_REQUIRED'
      });
    }
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based authorization middleware
export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ 
          message: 'You must be logged in to access this resource',
          code: 'AUTH_REQUIRED'
        });
      }
      
      if (!roles.includes(req.session.user.role)) {
        return res.status(403).json({ 
          message: 'You do not have permission to access this resource',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ 
        message: 'Authorization failed',
        code: 'AUTH_ERROR'
      });
    }
  };
};

// Restaurant-specific authorization middleware
export const authorizeRestaurant = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ 
        message: 'You must be logged in to access this resource',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // If the user is a platform admin, they have access to all restaurants
    if (req.session.user.role === 'platform_admin') {
      return next();
    }
    
    // Check if restaurant ID in request matches the user's restaurant
    const requestedRestaurantId = parseInt(req.params.restaurantId);
    
    if (isNaN(requestedRestaurantId)) {
      return res.status(400).json({ 
        message: 'Invalid restaurant ID format',
        code: 'INVALID_RESTAURANT_ID'
      });
    }
    
    if (req.session.user.restaurantId !== requestedRestaurantId) {
      return res.status(403).json({ 
        message: 'You do not have permission to access this restaurant\'s data',
        code: 'RESTAURANT_ACCESS_DENIED'
      });
    }
    
    next();
  } catch (error) {
    console.error('Restaurant authorization error:', error);
    res.status(500).json({ 
      message: 'Restaurant authorization failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Authentication functions
export const loginPlatformAdmin = async (email: string, password: string): Promise<AuthUser | null> => {
  try {
    // Validate input
    const validatedInput = loginSchema.parse({ email, password });
    
    const admin = await storage.getPlatformAdminByEmail(validatedInput.email);
    
    if (!admin) {
      return null;
    }
    
    const isPasswordValid = await bcrypt.compare(validatedInput.password, admin.password);
    
    if (!isPasswordValid) {
      return null;
    }
    
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'platform_admin'
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

export const loginRestaurant = async (email: string, password: string): Promise<AuthUser | null> => {
  try {
    // Validate input
    const validatedInput = loginSchema.parse({ email, password });
    
    const restaurant = await storage.getRestaurantByEmail(validatedInput.email);
    
    if (!restaurant) {
      return null;
    }
    
    const isPasswordValid = await bcrypt.compare(validatedInput.password, restaurant.password);
    
    if (!isPasswordValid) {
      return null;
    }
    
    return {
      id: restaurant.id,
      email: restaurant.email,
      name: restaurant.name,
      role: 'restaurant',
      restaurantId: restaurant.id
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

export const loginUser = async (email: string, password: string): Promise<AuthUser | null> => {
  try {
    // Validate input
    const validatedInput = loginSchema.parse({ email, password });
    
    const user = await storage.getUserByEmail(validatedInput.email);
    
    if (!user) {
      return null;
    }
    
    const isPasswordValid = await bcrypt.compare(validatedInput.password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name || email.split('@')[0],
      role: 'user',
      restaurantId: user.restaurantId || undefined
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};
