/**
 * Error Handling Utilities
 *
 * Classifies and handles different types of errors
 * Ported from NossoFlow with improvements
 */

import { logger } from './logger';

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorType {
  // User-fixable errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  // External errors (5xx, network)
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Application errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public override message: string,
    public userMessage: string,
    public statusCode?: number,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classifies HTTP status codes into error types
 */
export function classifyHttpError(statusCode: number): ErrorType {
  if (statusCode === 401) return ErrorType.AUTHENTICATION_ERROR;
  if (statusCode === 403) return ErrorType.AUTHORIZATION_ERROR;
  if (statusCode === 404) return ErrorType.NOT_FOUND_ERROR;
  if (statusCode === 429) return ErrorType.RATE_LIMIT_ERROR;
  if (statusCode >= 400 && statusCode < 500) return ErrorType.VALIDATION_ERROR;
  if (statusCode >= 500) return ErrorType.SERVER_ERROR;

  return ErrorType.UNKNOWN_ERROR;
}

/**
 * Classifies errors from WhatsApp API responses
 */
export function classifyWhatsAppError(error: unknown): ErrorType {
  if (!error) return ErrorType.UNKNOWN_ERROR;

  const err = error as { name?: string; message?: string; response?: { status?: number }; error?: { code?: number } };

  // Network errors
  if (err.name === 'TypeError' && err.message?.includes('fetch')) {
    return ErrorType.NETWORK_ERROR;
  }

  // Timeout errors
  if (err.name === 'AbortError' || err.message?.includes('timeout')) {
    return ErrorType.TIMEOUT_ERROR;
  }

  // HTTP status code errors
  if (err.response?.status) {
    return classifyHttpError(err.response.status);
  }

  // WhatsApp-specific error codes
  if (err.error?.code) {
    const code = err.error.code;
    if (code === 190) return ErrorType.AUTHENTICATION_ERROR;
    if (code === 100) return ErrorType.VALIDATION_ERROR;
    if (code === 4) return ErrorType.RATE_LIMIT_ERROR;
    if (code === 10) return ErrorType.AUTHORIZATION_ERROR;
    if (code === 200) return ErrorType.AUTHORIZATION_ERROR; // Permissions error
  }

  return ErrorType.UNKNOWN_ERROR;
}

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.VALIDATION_ERROR]: 'Dados inválidos. Por favor, verifique as informações e tente novamente.',
  [ErrorType.AUTHENTICATION_ERROR]: 'Credenciais inválidas ou expiradas. Por favor, atualize suas credenciais.',
  [ErrorType.AUTHORIZATION_ERROR]: 'Access Token sem permissões necessárias. Gere um novo token no Meta Business Manager com as permissões: whatsapp_business_management, whatsapp_business_messaging.',
  [ErrorType.NOT_FOUND_ERROR]: 'Recurso não encontrado. Verifique o WABA ID e Phone Number ID.',
  [ErrorType.RATE_LIMIT_ERROR]: 'Limite de taxa excedido. Por favor, aguarde antes de tentar novamente.',
  [ErrorType.SERVER_ERROR]: 'Erro no servidor do WhatsApp. Por favor, tente novamente mais tarde.',
  [ErrorType.NETWORK_ERROR]: 'Erro de conexão. Verifique sua internet e tente novamente.',
  [ErrorType.TIMEOUT_ERROR]: 'A requisição demorou muito para responder. Tente novamente.',
  [ErrorType.STORAGE_ERROR]: 'Erro ao acessar armazenamento local. Verifique se há espaço disponível.',
  [ErrorType.PARSE_ERROR]: 'Erro ao processar dados. Verifique o formato do arquivo.',
  [ErrorType.UNKNOWN_ERROR]: 'Ocorreu um erro inesperado. Por favor, tente novamente.',
};

/**
 * Gets user-friendly error message
 */
export function getUserErrorMessage(error: ErrorType | AppError): string {
  if (error instanceof AppError) {
    return error.userMessage || ERROR_MESSAGES[error.type];
  }
  return ERROR_MESSAGES[error] || ERROR_MESSAGES[ErrorType.UNKNOWN_ERROR];
}

// ============================================================================
// Error Handlers
// ============================================================================

/**
 * Handles API errors and returns AppError
 */
export function handleApiError(error: unknown, context?: Record<string, unknown>): AppError {
  const errorType = classifyWhatsAppError(error);
  const err = error as { message?: string; response?: { status?: number }; error?: { message?: string; code?: number } };
  const statusCode = err.response?.status;
  const message = err.message || 'Unknown API error';

  // Extract WhatsApp API error message if available
  let userMessage = getUserErrorMessage(errorType);

  // If WhatsApp API provides a detailed error message, use it
  if (err.error?.message) {
    const apiMessage = err.error.message;

    // Check for specific permission errors (#200)
    if (apiMessage.includes('#200') || apiMessage.includes('permission')) {
      userMessage = 'Erro de permissão (#200): O Access Token não tem permissões para acessar os templates. Verifique no Meta Business Manager se o token possui as permissões: whatsapp_business_management, whatsapp_business_messaging.';
    } else {
      // Use API message with the generic user message
      userMessage = `${getUserErrorMessage(errorType)} Detalhes: ${apiMessage}`;
    }
  }

  const appError = new AppError(errorType, message, userMessage, statusCode, {
    ...context,
    originalError: error,
    apiError: err.error,
  });

  // Log error
  logger.error('API Error', {
    type: errorType,
    message,
    statusCode,
    apiErrorCode: err.error?.code,
    apiErrorMessage: err.error?.message,
    context,
  });

  return appError;
}

/**
 * Handles storage errors
 */
export function handleStorageError(error: unknown, operation: string): AppError {
  const err = error as { message?: string };
  const message = `Storage error during ${operation}: ${err.message}`;
  const userMessage = ERROR_MESSAGES[ErrorType.STORAGE_ERROR];

  const appError = new AppError(
    ErrorType.STORAGE_ERROR,
    message,
    userMessage,
    undefined,
    { operation, originalError: error }
  );

  logger.error('Storage Error', {
    operation,
    error: err.message,
  });

  return appError;
}

/**
 * Handles parse errors (CSV, JSON, etc.)
 */
export function handleParseError(error: unknown, fileType: string): AppError {
  const err = error as { message?: string };
  const message = `Parse error for ${fileType}: ${err.message}`;
  const userMessage = ERROR_MESSAGES[ErrorType.PARSE_ERROR];

  const appError = new AppError(
    ErrorType.PARSE_ERROR,
    message,
    userMessage,
    undefined,
    { fileType, originalError: error }
  );

  logger.error('Parse Error', {
    fileType,
    error: err.message,
  });

  return appError;
}

/**
 * Handles validation errors
 */
export function handleValidationError(field: string, reason: string): AppError {
  const message = `Validation error for ${field}: ${reason}`;
  const userMessage = `${field}: ${reason}`;

  const appError = new AppError(
    ErrorType.VALIDATION_ERROR,
    message,
    userMessage,
    undefined,
    { field, reason }
  );

  logger.warn('Validation Error', {
    field,
    reason,
  });

  return appError;
}

// ============================================================================
// Error Recovery Strategies
// ============================================================================

/**
 * Determines if error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  return [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.SERVER_ERROR,
  ].includes(error.type);
}

/**
 * Calculates retry delay with exponential backoff
 * Per Meta recommendation: 4^X seconds
 */
export function getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  // Exponential backoff: baseDelay * 4^attemptNumber (Meta recommended)
  // Max delay: 60 seconds
  return Math.min(baseDelay * Math.pow(4, attemptNumber), 60000);
}

/**
 * Determines if error requires user action
 */
export function requiresUserAction(error: AppError): boolean {
  return [
    ErrorType.AUTHENTICATION_ERROR,
    ErrorType.AUTHORIZATION_ERROR,
    ErrorType.VALIDATION_ERROR,
  ].includes(error.type);
}

/**
 * Determines if error is a WhatsApp pair rate limit (131056)
 * This means we're sending too fast to the same recipient
 */
export function isPairRateLimitError(errorCode?: string | number): boolean {
  return errorCode === '131056' || errorCode === 131056;
}

/**
 * Gets recommended wait time for pair rate limit (6 seconds)
 */
export function getPairRateLimitWait(): number {
  return 6000; // 6 seconds per Meta documentation
}
