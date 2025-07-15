import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { createCacheManager } from './cache-manager';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000, // 15 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff with max delay of 30 seconds
      networkMode: 'online',
    },
    mutations: {
      networkMode: 'online',
      retry: 0,
    },
  },
});

// Initialize the cache manager with our query client
export const cacheManager = createCacheManager(queryClient);

// Export a function to reset the query client and cache manager (useful for testing or user logout)
export function resetQueryClientAndCache(): void {
  queryClient.clear();
  cacheManager.clearAll();
}
