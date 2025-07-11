/**
 * Standardized error handling and result types for the application
 */

import { ApiErrorCode } from '../types/api';

/**
 * Result pattern for safe error handling
 */
export type Result<T, E = AppError> = Success<T> | Failure<E>;

export interface Success<T> {
  success: true;
  data: T;
  error?: never;
}

export interface Failure<E> {
  success: false;
  data?: never;
  error: E;
}

/**
 * Helper functions to create results
 */
export const success = <T>(data: T): Success<T> => ({ success: true, data });
export const failure = <E>(error: E): Failure<E> => ({ success: false, error });

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Domain-specific error classes
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ApiErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, ApiErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ApiErrorCode.CONFLICT, 409, details);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, ApiErrorCode.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, ApiErrorCode.FORBIDDEN, 403);
    this.name = 'ForbiddenError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ApiErrorCode.OPERATION_NOT_ALLOWED, 422, details);
    this.name = 'BusinessRuleError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`External service '${service}' error: ${message}`, ApiErrorCode.EXTERNAL_SERVICE_ERROR, 502, details);
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error factory for creating typed errors
 */
export class ErrorFactory {
  static validation(message: string, field?: string): ValidationError {
    return new ValidationError(message, { field });
  }

  static notFound(resource: string, id?: string | number): NotFoundError {
    return new NotFoundError(resource, id);
  }

  static conflict(message: string): ConflictError {
    return new ConflictError(message);
  }

  static unauthorized(message?: string): UnauthorizedError {
    return new UnauthorizedError(message);
  }

  static forbidden(message?: string): ForbiddenError {
    return new ForbiddenError(message);
  }

  static businessRule(message: string): BusinessRuleError {
    return new BusinessRuleError(message);
  }

  static externalService(service: string, message: string): ExternalServiceError {
    return new ExternalServiceError(service, message);
  }

  static tableOccupied(tableNumber: number): BusinessRuleError {
    return new BusinessRuleError(`Table ${tableNumber} is currently occupied`);
  }

  static sessionExpired(): BusinessRuleError {
    return new BusinessRuleError('Session has expired');
  }

  static invalidStatusTransition(from: string, to: string): BusinessRuleError {
    return new BusinessRuleError(`Invalid status transition from '${from}' to '${to}'`);
  }

  static insufficientCapacity(requested: number, available: number): BusinessRuleError {
    return new BusinessRuleError(
      `Insufficient capacity: requested ${requested}, available ${available}`
    );
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  /**
   * Converts unknown error to AppError
   */
  static toAppError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, ApiErrorCode.INTERNAL_ERROR, 500, {
        originalError: error.name,
        stack: error.stack
      });
    }

    return new AppError(
      'An unknown error occurred',
      ApiErrorCode.INTERNAL_ERROR,
      500,
      { originalError: error }
    );
  }

  /**
   * Checks if error is of a specific type
   */
  static isErrorType<T extends AppError>(error: unknown, errorClass: new (...args: any[]) => T): error is T {
    return error instanceof errorClass;
  }

  /**
   * Safely executes an async function and returns a Result
   */
  static async safeAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
    try {
      const data = await fn();
      return success(data);
    } catch (error) {
      return failure(this.toAppError(error));
    }
  }

  /**
   * Safely executes a synchronous function and returns a Result
   */
  static safe<T>(fn: () => T): Result<T> {
    try {
      const data = fn();
      return success(data);
    } catch (error) {
      return failure(this.toAppError(error));
    }
  }

  /**
   * Logs error with context
   */
  static logError(error: AppError, context?: any): void {
    console.error('Application Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      context,
      timestamp: error.timestamp,
      stack: error.stack
    });
  }
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
  warnings?: ValidationWarning[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Creates a validation result
   */
  static createResult(
    errors: ValidationErrorDetail[] = [], 
    warnings: ValidationWarning[] = []
  ): ValidationResult {
    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Combines multiple validation results
   */
  static combine(...results: ValidationResult[]): ValidationResult {
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings || []);
    
    return this.createResult(allErrors, allWarnings);
  }

  /**
   * Creates a validation error
   */
  static error(field: string, message: string, code: string, value?: any): ValidationErrorDetail {
    return { field, message, code, value };
  }

  /**
   * Creates a validation warning
   */
  static warning(field: string, message: string, code: string, value?: any): ValidationWarning {
    return { field, message, code, value };
  }
}

/**
 * Async result utilities
 */
export class AsyncResultUtils {
  /**
   * Maps over a successful result
   */
  static async map<T, U>(result: Promise<Result<T>>, fn: (data: T) => U | Promise<U>): Promise<Result<U>> {
    const res = await result;
    if (!res.success) {
      return res;
    }
    
    try {
      const mappedData = await fn(res.data);
      return success(mappedData);
    } catch (error) {
      return failure(ErrorHandler.toAppError(error));
    }
  }

  /**
   * Flat maps over a successful result
   */
  static async flatMap<T, U>(
    result: Promise<Result<T>>, 
    fn: (data: T) => Promise<Result<U>>
  ): Promise<Result<U>> {
    const res = await result;
    if (!res.success) {
      return res;
    }
    
    try {
      return await fn(res.data);
    } catch (error) {
      return failure(ErrorHandler.toAppError(error));
    }
  }

  /**
   * Combines multiple results into one
   */
  static async all<T>(results: Promise<Result<T>>[]): Promise<Result<T[]>> {
    try {
      const resolvedResults = await Promise.all(results);
      
      const failures = resolvedResults.filter(r => !r.success);
      if (failures.length > 0) {
        // Return the first failure
        return failures[0] as Failure<AppError>;
      }
      
      const data = resolvedResults.map(r => (r as Success<T>).data);
      return success(data);
    } catch (error) {
      return failure(ErrorHandler.toAppError(error));
    }
  }

  /**
   * Recovers from an error with a default value
   */
  static async recover<T>(result: Promise<Result<T>>, defaultValue: T): Promise<Result<T>> {
    const res = await result;
    if (res.success) {
      return res;
    }
    
    return success(defaultValue);
  }
}

/**
 * Retry utilities for handling transient failures
 */
export class RetryUtils {
  /**
   * Retries an operation with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      retryIf?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryIf = () => true
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxAttempts || !retryIf(lastError)) {
          throw lastError;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

/**
 * Circuit breaker pattern for handling repeated failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AppError('Circuit breaker is OPEN', ApiErrorCode.EXTERNAL_SERVICE_ERROR, 503);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
           Date.now() - this.lastFailureTime.getTime() >= this.resetTimeout;
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}
