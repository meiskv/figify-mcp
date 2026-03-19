/**
 * Metrics tracking service for observability.
 * Tracks operation timings, resource usage, and other performance indicators.
 */

export type MetricOperation =
  | "resolve_url"
  | "capture_screenshot"
  | "extract_dom"
  | "create_frame"
  | "page_navigation"
  | "network_idle";

export type MetricStatus = "success" | "failure" | "timeout";

export interface OperationMetric {
  operation: MetricOperation;
  status: MetricStatus;
  duration: number; // milliseconds
  timestamp: number; // Unix timestamp in ms
  error?: string;
  metadata?: {
    url?: string;
    viewport?: string;
    screenshotSize?: number; // bytes
    layerCount?: number;
    retries?: number;
  };
}

export class MetricsService {
  private metrics: OperationMetric[] = [];
  private activeTimers: Map<string, number> = new Map();

  /**
   * Start timing an operation. Returns a timer ID.
   */
  startTimer(operationId: string): string {
    const timerId = `${operationId}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(timerId, Date.now());
    return timerId;
  }

  /**
   * End timing and record metric.
   */
  recordMetric(
    timerId: string,
    operation: MetricOperation,
    status: MetricStatus,
    metadata?: OperationMetric["metadata"],
    error?: string,
  ): OperationMetric {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      console.error(`[MetricsService] Timer ${timerId} not found`);
      // Fallback: create metric with 0 duration
      const metric: OperationMetric = {
        operation,
        status,
        duration: 0,
        timestamp: Date.now(),
        error,
        metadata,
      };
      this.metrics.push(metric);
      return metric;
    }

    const duration = Date.now() - startTime;
    const metric: OperationMetric = {
      operation,
      status,
      duration,
      timestamp: Date.now(),
      error,
      metadata,
    };

    this.metrics.push(metric);
    this.activeTimers.delete(timerId);

    // Log metric to stderr for observability
    this.logMetric(metric);

    return metric;
  }

  /**
   * Get all recorded metrics.
   */
  getMetrics(): OperationMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation.
   */
  getMetricsByOperation(operation: MetricOperation): OperationMetric[] {
    return this.metrics.filter((m) => m.operation === operation);
  }

  /**
   * Get summary statistics for an operation.
   */
  getOperationStats(operation: MetricOperation) {
    const ops = this.getMetricsByOperation(operation);
    if (ops.length === 0) {
      return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0, successRate: 0 };
    }

    const durations = ops.map((m) => m.duration);
    const successCount = ops.filter((m) => m.status === "success").length;

    return {
      count: ops.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / ops.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successCount / ops.length) * 100,
    };
  }

  /**
   * Clear all metrics (e.g., at the end of a session).
   */
  clear(): void {
    this.metrics = [];
    this.activeTimers.clear();
  }

  /**
   * Log a metric to stderr with formatted output.
   */
  private logMetric(metric: OperationMetric): void {
    const statusEmoji = {
      success: "✓",
      failure: "✗",
      timeout: "⏱",
    };

    const emoji = statusEmoji[metric.status];
    const metadataStr = metric.metadata ? ` | ${JSON.stringify(metric.metadata)}` : "";
    const errorStr = metric.error ? ` | Error: ${metric.error}` : "";

    console.error(
      `[Metrics] ${emoji} ${metric.operation} (${metric.duration}ms)${metadataStr}${errorStr}`,
    );
  }
}

// Singleton instance
export const metricsService = new MetricsService();
