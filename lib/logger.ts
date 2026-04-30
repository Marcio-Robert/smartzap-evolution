/**
 * Structured Logger
 *
 * Provides structured logging with trace IDs and context
 * Ported from NossoFlow
 */

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  traceId?: string;
  context?: Record<string, unknown>;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  getLogs(): LogEntry[];
  getLogsByLevel(level: LogEntry['level']): LogEntry[];
  clearLogs(): void;
  exportLogs(): string;
}

class StructuredLogger implements Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000; // Keep last 1000 logs in memory

  /**
   * Generates a unique trace ID for request tracking
   */
  private generateTraceId(): string {
    return crypto.randomUUID();
  }

  /**
   * Creates a log entry
   */
  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    return {
      level,
      message,
      timestamp: Date.now(),
      traceId: this.generateTraceId(),
      context,
    };
  }

  /**
   * Stores log entry in memory and outputs to console
   */
  private log(entry: LogEntry): void {
    // Add to memory
    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console
    const timestamp = new Date(entry.timestamp).toISOString();
    const contextStr = entry.context ? JSON.stringify(entry.context) : '';
    const logMessage = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.traceId?.slice(0, 8)}] ${entry.message} ${contextStr}`;

    switch (entry.level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(logMessage);
        }
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * Logs an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(this.createLogEntry('info', message, context));
  }

  /**
   * Logs a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(this.createLogEntry('warn', message, context));
  }

  /**
   * Logs an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log(this.createLogEntry('error', message, context));
  }

  /**
   * Logs a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(this.createLogEntry('debug', message, context));
  }

  /**
   * Gets all stored logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Gets logs filtered by level
   */
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Gets logs within a time range
   */
  getLogsByTimeRange(startTime: number, endTime: number): LogEntry[] {
    return this.logs.filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  /**
   * Clears all stored logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Exports logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const logger = new StructuredLogger();

/**
 * Generates a unique trace ID for request tracking
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Convenience Functions for Common Logging Patterns
// ============================================================================

/**
 * Logs API request
 */
export function logApiRequest(method: string, url: string, data?: unknown): void {
  logger.info('API Request', {
    method,
    url,
    data: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Logs API response
 */
export function logApiResponse(method: string, url: string, status: number, data?: unknown): void {
  logger.info('API Response', {
    method,
    url,
    status,
    data: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Logs API error
 */
export function logApiError(method: string, url: string, error: Error): void {
  logger.error('API Error', {
    method,
    url,
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Logs campaign event
 */
export function logCampaignEvent(campaignId: string, event: string, data?: Record<string, unknown>): void {
  logger.info('Campaign Event', {
    campaignId,
    event,
    ...data,
  });
}

/**
 * Logs message send event
 */
export function logMessageSend(
  phoneNumber: string,
  templateId: string,
  status: 'success' | 'failed',
  error?: string
): void {
  if (status === 'success') {
    logger.info('Message Sent', {
      phoneNumber,
      templateId,
      status,
    });
  } else {
    logger.error('Message Send Failed', {
      phoneNumber,
      templateId,
      status,
      error,
    });
  }
}
