import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Optimized QueryClient configuration for better performance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Optimized caching strategy
      staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      refetchOnReconnect: true, // Refetch when reconnecting
      refetchOnMount: true, // Refetch when component mounts
      retry: (failureCount: number, error: unknown) => {
        // Retry logic with exponential backoff
        if (failureCount >= 3) return false;
        if (error instanceof Error && error.message.includes('401')) return false;
        return true;
      },
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Background updates for better UX
      refetchInterval: false, // Disable automatic refetching by default
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: (failureCount: number, error: unknown) => {
        // Retry mutations with different logic
        if (failureCount >= 2) return false;
        if (error instanceof Error && error.message.includes('401')) return false;
        return true;
      },
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Optimistic updates for better UX
      onMutate: async (variables: unknown) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries();
        return { previousData: queryClient.getQueryData(['previousData']) };
      },
      onError: (err: unknown, variables: unknown, context: any) => {
        // Rollback on error
        if (context?.previousData) {
          queryClient.setQueryData(['previousData'], context.previousData);
        }
      },
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries();
      },
    },
  },
});

// Prefetch function for critical data
export const prefetchQuery = async (queryKey: string[], queryFn: () => Promise<any>) => {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000,
  });
};

// Optimistic update helper
export const optimisticUpdate = <T>(
  queryKey: string[],
  updater: (oldData: T | undefined) => T
) => {
  queryClient.setQueryData(queryKey, updater);
};

// Batch invalidation helper
export const invalidateQueries = (queryKeys: string[][]) => {
  queryClient.invalidateQueries({ queryKey: queryKeys });
};
