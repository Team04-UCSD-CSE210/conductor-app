/**
 * Metrics Middleware
 * 
 * Express middleware to capture custom metrics for each HTTP request
 */

import { customMetrics } from '../instrumentation.js';

/**
 * Middleware to track HTTP request metrics
 */
export function metricsMiddleware(req, res, next) {
  const startTime = Date.now();

  // Increment request counter
  customMetrics.httpRequestCounter.add(1, {
    method: req.method,
    route: req.route?.path || req.path,
    status: 'pending',
  });

  // Hook into response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const route = req.route?.path || req.path;

    // Record request duration
    customMetrics.httpRequestDuration.record(duration, {
      method: req.method,
      route,
      status: statusCode,
    });

    // Track errors
    if (statusCode >= 400) {
      customMetrics.apiErrorCounter.add(1, {
        method: req.method,
        route,
        status: statusCode,
        error_type: statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  });

  next();
}

/**
 * Track user login attempts
 */
export function trackLogin(success, method = 'google') {
  customMetrics.userLoginCounter.add(1, {
    success: success.toString(),
    method,
  });
}

/**
 * Track database queries
 */
export function trackDatabaseQuery(queryType, duration) {
  customMetrics.dbQueryCounter.add(1, {
    query_type: queryType,
  });

  if (duration !== undefined) {
    customMetrics.dbQueryDuration.record(duration, {
      query_type: queryType,
    });
  }
}

/**
 * Track session changes
 */
export function trackSessionChange(change) {
  // change should be 1 for new session, -1 for logout
  customMetrics.activeSessionsGauge.add(change);
}

/**
 * Track journal entries
 */
export function trackJournalEntry(userType = 'student') {
  customMetrics.journalEntriesCounter.add(1, {
    user_type: userType,
  });
}

/**
 * Track attendance records
 */
export function trackAttendance(status = 'present') {
  customMetrics.attendanceRecordsCounter.add(1, {
    status,
  });
}
