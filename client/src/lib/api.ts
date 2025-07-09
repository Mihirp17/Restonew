import { toast } from "@/hooks/use-toast";

interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>({ method, url, data, headers = {} }: ApiRequestOptions): Promise<T> {
  try {
    // Always set Content-Type for requests that might have a body
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      credentials: 'include',
      ...(data && { body: JSON.stringify(data) }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || 'An error occurred');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API request failed:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "An error occurred",
      variant: "destructive",
    });
    throw error;
  }
} 