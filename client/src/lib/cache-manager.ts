import { QueryClient } from '@tanstack/react-query';

// Resource types to categorize queries
export enum CacheResource {
  ORDERS = 'orders',
  BILLS = 'bills',
  SESSIONS = 'sessions',
  TABLES = 'tables',
  CUSTOMERS = 'customers',
  MENU = 'menu',
  RESTAURANT = 'restaurant',
  ANALYTICS = 'analytics',
  USER = 'user',
}

// Cache tags to identify related queries
export type CacheTag = 
  | `${CacheResource}`
  | `${CacheResource}:${number}`
  | `${CacheResource}:${string}`;

// Cache manager to centralize and standardize cache operations
export class CacheManager {
  private queryClient: QueryClient;
  
  // Map of query keys to tags for related invalidation
  private queryTags: Map<string, Set<CacheTag>> = new Map();

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  // Register a query with tags
  public setQueryTags(queryKey: any[], tags: CacheTag[]): void {
    const queryKeyString = this.serializeQueryKey(queryKey);
    
    if (!this.queryTags.has(queryKeyString)) {
      this.queryTags.set(queryKeyString, new Set());
    }
    
    const tagSet = this.queryTags.get(queryKeyString)!;
    tags.forEach(tag => tagSet.add(tag));
  }

  // Get all tags for a query
  public getQueryTags(queryKey: any[]): CacheTag[] {
    const queryKeyString = this.serializeQueryKey(queryKey);
    const tagSet = this.queryTags.get(queryKeyString);
    return tagSet ? [...tagSet] : [];
  }

  // Invalidate queries by tag
  public invalidateQueries(tags: CacheTag[]): Promise<void> {
    // Map of tags to query keys that need invalidation
    const queriesToInvalidate = new Set<string>();
    
    // Find all query keys that have any of the specified tags
    for (const [queryKeyString, queryTags] of this.queryTags.entries()) {
      if (tags.some(tag => queryTags.has(tag))) {
        queriesToInvalidate.add(queryKeyString);
      }
    }
    
    // Invalidate all matched queries
    const invalidationPromises = [...queriesToInvalidate].map(queryKeyString => {
      const queryKey = this.deserializeQueryKey(queryKeyString);
      return this.queryClient.invalidateQueries({ queryKey });
    });
    
    return Promise.all(invalidationPromises).then(() => {});
  }
  
  // Invalidate all queries related to a specific resource
  public invalidateResourceQueries(resource: CacheResource, id?: number | string): Promise<void> {
    const tag = id ? `${resource}:${id}` : resource;
    return this.invalidateQueries([tag as CacheTag]);
  }
  
  // Clear query cache and tags for a specific query key
  public clearQueryCache(queryKey: any[]): void {
    const queryKeyString = this.serializeQueryKey(queryKey);
    this.queryTags.delete(queryKeyString);
    this.queryClient.removeQueries({ queryKey });
  }
  
  // Clear all cached data and tags
  public clearAll(): void {
    this.queryTags.clear();
    this.queryClient.clear();
  }
  
  // Register a restaurant-specific query
  public registerRestaurantQuery(
    queryKey: any[], 
    restaurantId: number, 
    resource: CacheResource, 
    resourceId?: number | string
  ): void {
    const tags: CacheTag[] = [
      CacheResource.RESTAURANT,
      `${CacheResource.RESTAURANT}:${restaurantId}`,
      resource
    ];
    
    if (resourceId) {
      tags.push(`${resource}:${resourceId}` as CacheTag);
    }
    
    this.setQueryTags(queryKey, tags);
  }
  
  // Get standard query key format for endpoints
  public getStandardQueryKey(endpoint: string, params?: Record<string, any>): any[] {
    if (!params) {
      return [endpoint];
    }
    return [endpoint, params];
  }
  
  // Helper to serialize query keys for storage
  private serializeQueryKey(queryKey: any[]): string {
    return JSON.stringify(queryKey);
  }
  
  // Helper to deserialize query keys from storage
  private deserializeQueryKey(queryKeyString: string): any[] {
    return JSON.parse(queryKeyString);
  }
  
  // Helper to get all related queries for a specific resource
  public getQueriesForResource(resource: CacheResource): string[] {
    const resourceTag = resource as CacheTag;
    const relatedQueries: string[] = [];
    
    for (const [queryKeyString, tags] of this.queryTags.entries()) {
      if (tags.has(resourceTag)) {
        relatedQueries.push(queryKeyString);
      }
    }
    
    return relatedQueries;
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null;

// Factory function to create or get the cache manager instance
export function createCacheManager(queryClient: QueryClient): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(queryClient);
  }
  return cacheManagerInstance;
}

// Function to get existing cache manager
export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    throw new Error('Cache manager not initialized. Call createCacheManager first.');
  }
  return cacheManagerInstance;
} 