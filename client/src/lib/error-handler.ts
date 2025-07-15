import { toast } from '@/hooks/use-toast';

// Match the error types from the server
export enum ErrorType {
  VALIDATION = 'validation_error',
  AUTHENTICATION = 'auth_error',
  AUTHORIZATION = 'permission_error',
  NOT_FOUND = 'not_found',
  DUPLICATE = 'duplicate_resource',
  SERVER_ERROR = 'server_error',
  BUSINESS_LOGIC = 'business_logic_error'
}

// Interface matching server response
export interface ErrorResponse {
  type: ErrorType;
  message: string;
  details?: any;
  code?: string;
  timestamp: string;
}

// Client-side error handling class
export class ErrorHandler {
  // Handle API errors from response
  static async handleApiError(response: Response): Promise<ErrorResponse> {
    try {
      const errorData = await response.json();
      return errorData as ErrorResponse;
    } catch (e) {
      // If the response can't be parsed as JSON
      return {
        type: ErrorType.SERVER_ERROR,
        message: `API error: ${response.status} ${response.statusText}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Display appropriate toast based on error type
  static showToast(error: ErrorResponse): void {
    let title = 'Error';
    let variant: 'default' | 'destructive' = 'destructive';
    
    // Customize toast based on error type
    switch (error.type) {
      case ErrorType.VALIDATION:
        title = 'Validation Error';
        break;
      case ErrorType.AUTHENTICATION:
        title = 'Authentication Error';
        break;
      case ErrorType.AUTHORIZATION:
        title = 'Permission Denied';
        break;
      case ErrorType.NOT_FOUND:
        title = 'Not Found';
        break;
      case ErrorType.DUPLICATE:
        title = 'Duplicate Error';
        break;
      case ErrorType.BUSINESS_LOGIC:
        title = 'Business Rule Violation';
        variant = 'default'; // Use less destructive style for business rules
        break;
      default:
        title = 'Server Error';
    }
    
    toast({
      title,
      description: error.message,
      variant
    });
  }

  // Format validation errors for display
  static formatValidationErrors(error: ErrorResponse): string {
    if (!error.details || !Array.isArray(error.details)) {
      return error.message;
    }
    
    return error.details
      .map(detail => `${detail.path}: ${detail.message}`)
      .join('\n');
  }
  
  // Helper to handle common error scenarios
  static async handleFetchError(response: Response, showToastOnError = true): Promise<ErrorResponse | null> {
    if (!response.ok) {
      const errorResponse = await this.handleApiError(response);
      if (showToastOnError) {
        this.showToast(errorResponse);
      }
      return errorResponse;
    }
    return null;
  }
  
  // Log errors to console with consistent formatting
  static logError(error: any, context: string = ''): void {
    if (error instanceof Error) {
      console.error(`[${context}] ${error.name}: ${error.message}`, error.stack);
    } else if (typeof error === 'object' && error !== null) {
      console.error(`[${context}]`, error);
    } else {
      console.error(`[${context}] Unknown error:`, error);
    }
  }
  
  // Helper function for hooks to handle and log errors
  static handleError(error: any, context: string = ''): any {
    // Log the error
    this.logError(error, context);
    
    // If it's an ErrorResponse already, just pass it through
    if (error && error.type && error.message && error.timestamp) {
      return error;
    }
    
    // Otherwise, create a standardized error object
    const standardError = {
      type: ErrorType.SERVER_ERROR,
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
    
    // Show toast with error details
    this.showToast(standardError);
    
    // Return the standardized error
    return standardError;
  }
} 

// Convenience export for direct import
export const handleError = ErrorHandler.handleError.bind(ErrorHandler); 