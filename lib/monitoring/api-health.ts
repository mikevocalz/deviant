/**
 * API HEALTH MONITORING
 *
 * Tracks API response status codes and logs anomalies.
 * Provides early warning for backend issues.
 */

const IS_DEV = __DEV__;

interface ApiCallMetrics {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
}

// In-memory metrics buffer (last 100 calls)
const metricsBuffer: ApiCallMetrics[] = [];
const MAX_BUFFER_SIZE = 100;

// Error thresholds for alerting
const ERROR_THRESHOLDS = {
  401: 3, // 3 unauthorized in a row = likely auth issue
  404: 5, // 5 not found = likely routing issue
  409: 3, // 3 conflicts = likely duplicate data issue
  500: 2, // 2 server errors = backend down
};

// Track consecutive errors by status code
const consecutiveErrors: Record<number, number> = {};

/**
 * Log an API call for monitoring.
 * Call this after every fetch() to track health.
 */
export function logApiCall(metrics: ApiCallMetrics): void {
  // Add to buffer
  metricsBuffer.push(metrics);
  if (metricsBuffer.length > MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }

  const { endpoint, method, status, duration } = metrics;

  // Track non-2xx responses
  if (status < 200 || status >= 300) {
    // Increment consecutive error count
    consecutiveErrors[status] = (consecutiveErrors[status] || 0) + 1;

    // Check if threshold exceeded
    const threshold = ERROR_THRESHOLDS[status as keyof typeof ERROR_THRESHOLDS];
    if (threshold && consecutiveErrors[status] >= threshold) {
      const message =
        `[API HEALTH] Alert: ${consecutiveErrors[status]} consecutive ${status} errors.\n` +
        `Last endpoint: ${method} ${endpoint}`;

      console.error(message);

      // In production, this would send to Sentry/monitoring service
      if (!IS_DEV) {
        // TODO: Send to monitoring service
        // Sentry.captureMessage(message, "warning");
      }
    }

    // Log individual errors
    if (IS_DEV) {
      console.warn(`[API] ${method} ${endpoint} → ${status} (${duration}ms)`);
    }
  } else {
    // Reset consecutive error count for this status on success
    Object.keys(consecutiveErrors).forEach((key) => {
      consecutiveErrors[Number(key)] = 0;
    });
  }

  // Log slow requests (> 3s)
  if (duration > 3000) {
    console.warn(
      `[API] Slow request: ${method} ${endpoint} took ${duration}ms`,
    );
  }
}

/**
 * Get recent API metrics for debugging.
 */
export function getRecentMetrics(): ApiCallMetrics[] {
  return [...metricsBuffer];
}

/**
 * Get error rate for a specific status code.
 */
export function getErrorRate(statusCode: number): number {
  const total = metricsBuffer.length;
  if (total === 0) return 0;

  const errors = metricsBuffer.filter((m) => m.status === statusCode).length;
  return errors / total;
}

/**
 * Get overall health status.
 */
export function getHealthStatus(): {
  healthy: boolean;
  errorRate: number;
  recentErrors: ApiCallMetrics[];
} {
  const total = metricsBuffer.length;
  const errors = metricsBuffer.filter((m) => m.status < 200 || m.status >= 300);
  const errorRate = total > 0 ? errors.length / total : 0;

  return {
    healthy: errorRate < 0.1, // < 10% error rate
    errorRate,
    recentErrors: errors.slice(-10),
  };
}

/**
 * Create a fetch wrapper that automatically logs metrics.
 */
export function createMonitoredFetch(
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const startTime = Date.now();
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : input.toString();
    const method = init?.method || "GET";

    try {
      const response = await baseFetch(input, init);
      const duration = Date.now() - startTime;

      logApiCall({
        endpoint: url,
        method,
        status: response.status,
        duration,
        timestamp: startTime,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logApiCall({
        endpoint: url,
        method,
        status: 0, // Network error
        duration,
        timestamp: startTime,
      });

      throw error;
    }
  };
}
