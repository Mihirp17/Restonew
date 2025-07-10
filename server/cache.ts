import { LRUCache } from 'lru-cache';

// Cache configuration
const cacheConfig = {
  max: 500, // Maximum number of items
  ttl: 1000 * 60 * 5, // 5 minutes default TTL
  updateAgeOnGet: true, // Update age when accessed
  allowStale: true, // Allow stale items to be returned
  noDisposeOnSet: true, // Don't dispose on set
  dispose: (value: any, key: string) => {
    console.log(`Cache item disposed: ${key}`);
  }
};

// Create separate caches for different data types
export const restaurantCache = new LRUCache<string, any>({
  ...cacheConfig,
  ttl: 1000 * 60 * 10, // 10 minutes for restaurant data
  max: 100
});

export const menuCache = new LRUCache<string, any>({
  ...cacheConfig,
  ttl: 1000 * 60 * 15, // 15 minutes for menu data
  max: 200
});

export const orderCache = new LRUCache<string, any>({
  ...cacheConfig,
  ttl: 1000 * 30, // 30 seconds for order data (frequently changing)
  max: 300
});

export const analyticsCache = new LRUCache<string, any>({
  ...cacheConfig,
  ttl: 1000 * 60 * 30, // 30 minutes for analytics data
  max: 50
});

export const aiCache = new LRUCache<string, any>({
  ...cacheConfig,
  ttl: 1000 * 60 * 60, // 1 hour for AI insights
  max: 100
});

// Cache utility functions
export const cacheKeys = {
  restaurant: (id: number) => `restaurant:${id}`,
  menu: (restaurantId: number) => `menu:${restaurantId}`,
  orders: (restaurantId: number, status?: string) => `orders:${restaurantId}:${status || 'all'}`,
  analytics: (restaurantId: number, type: string, dateRange?: string) => 
    `analytics:${restaurantId}:${type}:${dateRange || 'default'}`,
  aiInsights: (restaurantId: number) => `ai:insights:${restaurantId}`,
  aiChat: (restaurantId: number, sessionId: string) => `ai:chat:${restaurantId}:${sessionId}`
};

// Cache invalidation functions
export const invalidateRestaurantCache = (restaurantId: number) => {
  restaurantCache.delete(cacheKeys.restaurant(restaurantId));
  menuCache.delete(cacheKeys.menu(restaurantId));
  // Invalidate related caches
  orderCache.clear();
  analyticsCache.clear();
};

export const invalidateMenuCache = (restaurantId: number) => {
  menuCache.delete(cacheKeys.menu(restaurantId));
};

export const invalidateOrderCache = (restaurantId: number) => {
  orderCache.clear();
  analyticsCache.clear();
};

export const invalidateAnalyticsCache = (restaurantId: number) => {
  analyticsCache.clear();
};

export const invalidateAiCache = (restaurantId: number) => {
  aiCache.delete(cacheKeys.aiInsights(restaurantId));
};

// Cache wrapper function
export const withCache = async <T>(
  cache: LRUCache<string, T>,
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const result = await fn();
    cache.set(key, result, { ttl });
    return result;
  } catch (error) {
    console.error(`Cache miss for key ${key}:`, error);
    throw error;
  }
};

// Cache statistics
export const getCacheStats = () => {
  return {
    restaurant: {
      size: restaurantCache.size,
      hits: restaurantCache.stats.hits,
      misses: restaurantCache.stats.misses
    },
    menu: {
      size: menuCache.size,
      hits: menuCache.stats.hits,
      misses: menuCache.stats.misses
    },
    orders: {
      size: orderCache.size,
      hits: orderCache.stats.hits,
      misses: orderCache.stats.misses
    },
    analytics: {
      size: analyticsCache.size,
      hits: analyticsCache.stats.hits,
      misses: analyticsCache.stats.misses
    },
    ai: {
      size: aiCache.size,
      hits: aiCache.stats.hits,
      misses: aiCache.stats.misses
    }
  };
};