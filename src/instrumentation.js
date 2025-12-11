/**
 * OpenTelemetry Instrumentation for SigNoz
 * 
 * This file sets up metrics and tracing for the Conductor application.
 * It must be imported BEFORE any other modules in server.js
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';

// Configuration from environment variables
const SIGNOZ_ENDPOINT = process.env.SIGNOZ_ENDPOINT || 'http://localhost:4318';
const SIGNOZ_ACCESS_TOKEN = process.env.SIGNOZ_ACCESS_TOKEN;
const SERVICE_NAME = process.env.SERVICE_NAME || 'conductor-app';
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Configure headers for SigNoz Cloud authentication
const headers = SIGNOZ_ACCESS_TOKEN 
  ? { 'signoz-access-token': SIGNOZ_ACCESS_TOKEN }
  : {};

// Configure trace exporter
const traceExporter = new OTLPTraceExporter({
  url: `${SIGNOZ_ENDPOINT}/v1/traces`,
  headers,
});

// Configure metric exporter
const metricExporter = new OTLPMetricExporter({
  url: `${SIGNOZ_ENDPOINT}/v1/metrics`,
  headers,
});

// Create metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 10000, // Export every 10 seconds
});

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  serviceName: SERVICE_NAME,
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Automatically instrument Express, HTTP, PostgreSQL, etc.
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable file system instrumentation for performance
      },
    }),
  ],
});

// Start the SDK
try {
  sdk.start();
} catch (error) {
  console.error('[OpenTelemetry] Failed to start instrumentation:', error);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
    .catch((error) => console.error('[OpenTelemetry] Error shutting down SDK', error))
    .finally(() => process.exit(0));
});

// Create custom metrics
const meter = metrics.getMeter(SERVICE_NAME);

// Custom application metrics
export const customMetrics = {
  // Counter for HTTP requests
  httpRequestCounter: meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  }),

  // Histogram for request duration
  httpRequestDuration: meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  }),

  // Counter for user logins
  userLoginCounter: meter.createCounter('user_logins_total', {
    description: 'Total number of user login attempts',
  }),

  // Counter for database queries
  dbQueryCounter: meter.createCounter('db_queries_total', {
    description: 'Total number of database queries',
  }),

  // Histogram for database query duration
  dbQueryDuration: meter.createHistogram('db_query_duration_ms', {
    description: 'Database query duration in milliseconds',
    unit: 'ms',
  }),

  // Counter for API errors
  apiErrorCounter: meter.createCounter('api_errors_total', {
    description: 'Total number of API errors',
  }),

  // Gauge for active sessions
  activeSessionsGauge: meter.createUpDownCounter('active_sessions', {
    description: 'Number of active user sessions',
  }),

  // Counter for journal entries
  journalEntriesCounter: meter.createCounter('journal_entries_total', {
    description: 'Total number of journal entries created',
  }),

  // Counter for attendance records
  attendanceRecordsCounter: meter.createCounter('attendance_records_total', {
    description: 'Total number of attendance records',
  }),
};

export default sdk;
