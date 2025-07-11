import { storage } from './storage.js';

// Cache configuration
const CACHE_TTL = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  VERY_LONG: 60 * 60 * 1000 // 1 hour
};

// Cache stores
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Cache management
export class CacheManager {
  static get(key: string): any | null {
    const item = cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  static set(key: string, data: any, ttl: number = CACHE_TTL.MEDIUM): void {
    cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  static delete(key: string): void {
    cache.delete(key);
  }
  
  static clear(): void {
    cache.clear();
  }
  
  static invalidatePattern(pattern: string): void {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  }
}

// Database query optimization
export class QueryOptimizer {
  // Batch fetch orders with optimized queries
  static async getOptimizedOrders(restaurantId: number, options: { 
    startDate?: Date; 
    endDate?: Date; 
    limit?: number;
    includeItems?: boolean;
  } = {}) {
    const cacheKey = `orders:${restaurantId}:${JSON.stringify(options)}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    
    const orders = await storage.getOrdersByRestaurantId(restaurantId, options);
    
    // If items are requested, batch fetch them
    if (options.includeItems) {
      const orderItems = await Promise.all(
        orders.map(order => storage.getOrderItemsByOrderId(order.id))
      );
      
      const result = orders.map((order, index) => ({
        ...order,
        items: orderItems[index] || []
      }));
      
      CacheManager.set(cacheKey, result, CACHE_TTL.SHORT);
      return result;
    }
    
    CacheManager.set(cacheKey, orders, CACHE_TTL.SHORT);
    return orders;
  }
  
  // Optimized analytics queries
  static async getOptimizedAnalytics(restaurantId: number, dateRange: { startDate: Date; endDate: Date }) {
    const cacheKey = `analytics:${restaurantId}:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    
    const [orders, feedback, menuItems] = await Promise.all([
      storage.getOrdersByRestaurantId(restaurantId, dateRange),
      storage.getFeedbackByRestaurantId(restaurantId, dateRange),
      storage.getMenuItems(restaurantId)
    ]);
    
    // Calculate metrics efficiently
    const metrics = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + parseFloat(order.total), 0),
      averageOrderValue: orders.length > 0 ? 
        orders.reduce((sum, order) => sum + parseFloat(order.total), 0) / orders.length : 0,
      averageRating: feedback.length > 0 ? 
        feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : 0,
      menuItemCount: menuItems.length
    };
    
    CacheManager.set(cacheKey, metrics, CACHE_TTL.MEDIUM);
    return metrics;
  }
}

// Response optimization
export class ResponseOptimizer {
  // Compress and optimize API responses
  static optimizeResponse(data: any, options: { 
    compress?: boolean; 
    removeNulls?: boolean;
    limitFields?: string[];
  } = {}) {
    let optimized = data;
    
    if (options.removeNulls) {
      optimized = this.removeNullValues(optimized);
    }
    
    if (options.limitFields && Array.isArray(optimized)) {
      optimized = optimized.map(item => {
        const limited: any = {};
        options.limitFields!.forEach(field => {
          if (item[field] !== undefined) {
            limited[field] = item[field];
          }
        });
        return limited;
      });
    }
    
    return optimized;
  }
  
  private static removeNullValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeNullValues(item));
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
          cleaned[key] = this.removeNullValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
}

// Memory management
export class MemoryManager {
  private static readonly MAX_CACHE_SIZE = 1000;
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  static init(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }
  
  private static cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, item] of cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        cache.delete(key);
        deletedCount++;
      }
    }
    
    // If cache is too large, remove oldest entries
    if (cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toDelete.forEach(([key]) => cache.delete(key));
    }
    
    if (deletedCount > 0) {
      console.log(`[MemoryManager] Cleaned up ${deletedCount} expired cache entries`);
    }
  }
}

// Initialize memory management
MemoryManager.init();