import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Standard error types for better error classification
export enum ErrorType {
  VALIDATION = 'validation_error',
  AUTHENTICATION = 'auth_error',
  AUTHORIZATION = 'permission_error',
  NOT_FOUND = 'not_found',
  DUPLICATE = 'duplicate_resource',
  SERVER_ERROR = 'server_error',
  BUSINESS_LOGIC = 'business_logic_error'
}

// Standard error response structure
export interface ErrorResponse {
  type: ErrorType;
  message: string;
  details?: any;
  code?: string;
  timestamp: string;
}

// Centralized error handling class
export class ErrorHandler {
  // Handle general errors and convert to standard format
  static handle(error: any): ErrorResponse {
    // Default to server error if not classified
    const errorType = error.type || ErrorType.SERVER_ERROR;
    
    // Format error for consistent client response
    const errorResponse: ErrorResponse = {
      type: errorType,
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };
    
    // Add additional details for certain error types
    if (error.details) {
      errorResponse.details = error.details;
    }
    
    if (error.code) {
      errorResponse.code = error.code;
    }
    
    return errorResponse;
  }
  
  // Handle Zod validation errors specifically
  static handleZodError(error: z.ZodError): ErrorResponse {
    return {
      type: ErrorType.VALIDATION,
      message: 'Validation failed',
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      })),
      timestamp: new Date().toISOString()
    };
  }
  
  // Create a business logic error
  static businessLogic(message: string, details?: any): Error & { type: ErrorType; details?: any } {
    const error = new Error(message) as Error & { type: ErrorType; details?: any };
    error.type = ErrorType.BUSINESS_LOGIC;
    if (details) {
      error.details = details;
    }
    return error;
  }
  
  // Create a not found error
  static notFound(resource: string, id?: string | number): Error & { type: ErrorType; details?: any } {
    const message = id 
      ? `${resource} with id ${id} not found` 
      : `${resource} not found`;
    const error = new Error(message) as Error & { type: ErrorType; details?: any };
    error.type = ErrorType.NOT_FOUND;
    return error;
  }
  
  // Create a duplicate resource error
  static duplicate(resource: string, field: string, value: string): Error & { type: ErrorType; details?: any } {
    const error = new Error(`${resource} with ${field} '${value}' already exists`) as Error & { type: ErrorType; details?: any };
    error.type = ErrorType.DUPLICATE;
    error.details = { field, value };
    return error;
  }
  
  // Create an authentication error
  static auth(message: string = 'Authentication failed'): Error & { type: ErrorType } {
    const error = new Error(message) as Error & { type: ErrorType };
    error.type = ErrorType.AUTHENTICATION;
    return error;
  }
  
  // Create an authorization error
  static permission(message: string = 'You do not have permission to perform this action'): Error & { type: ErrorType } {
    const error = new Error(message) as Error & { type: ErrorType };
    error.type = ErrorType.AUTHORIZATION;
    return error;
  }
}

// Express middleware for handling errors
export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('Error caught by middleware:', err);
  
  let errorResponse: ErrorResponse;
  
  if (err instanceof z.ZodError) {
    errorResponse = ErrorHandler.handleZodError(err);
    return res.status(400).json(errorResponse);
  } else {
    errorResponse = ErrorHandler.handle(err);
    
    // Set appropriate status code based on error type
    let statusCode = 500;
    switch (errorResponse.type) {
      case ErrorType.VALIDATION:
        statusCode = 400;
        break;
      case ErrorType.AUTHENTICATION:
        statusCode = 401;
        break;
      case ErrorType.AUTHORIZATION:
        statusCode = 403;
        break;
      case ErrorType.NOT_FOUND:
        statusCode = 404;
        break;
      case ErrorType.DUPLICATE:
        statusCode = 409;
        break;
      case ErrorType.BUSINESS_LOGIC:
        statusCode = 422;
        break;
      default:
        statusCode = 500;
    }
    
    return res.status(statusCode).json(errorResponse);
  }
} 