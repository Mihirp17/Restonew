import { toast } from '@/hooks/use-toast';
import { ErrorHandler } from './error-handler';

export interface ApiRequestOptions {
  method: string;
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
      // Use our error handler to process the error response
      const errorResponse = await ErrorHandler.handleApiError(response);
      
      // Log the error with context
      ErrorHandler.logError(errorResponse, `API ${method} ${url}`);
      
      // Show toast with error details
      ErrorHandler.showToast(errorResponse);
      
      // Throw a standardized error object
      throw errorResponse;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    // Handle errors that weren't from the API (e.g., network errors)
    if (!('type' in (error as any))) {
      ErrorHandler.logError(error, `API ${method} ${url}`);
      
      // Create a generic error response for non-API errors
      const genericError = {
        type: 'server_error',
        message: error instanceof Error ? error.message : "Network or unexpected error",
        timestamp: new Date().toISOString()
      };
      
    toast({
        title: "Connection Error",
        description: genericError.message,
      variant: "destructive",
    });
      
      throw genericError;
    }
    
    // Pass through already formatted API errors
    throw error;
  }
} 