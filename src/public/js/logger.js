/**
 * Logger utility — tracks key events in localStorage for auditing
 * 
 * This module provides client-side logging functionality that persists
 * events in the browser's localStorage. Useful for tracking user actions
 * and system events on the client side.
 * 
 * @module logger
 */

const STORAGE_KEY = 'systemLogs';

/**
 * Log an event to localStorage
 * 
 * @param {string} type - Event type (e.g., 'LOGIN', 'LOGOUT', 'ROLE_UPDATE', 'PAGE_VIEW')
 * @param {string} [userEmail] - User email associated with the event (defaults to 'anonymous')
 * @param {string} [details] - Additional details about the event (optional)
 * @returns {void}
 * 
 * @example
 * logEvent('LOGIN', 'user@example.com', 'User logged in via Google OAuth');
 * logEvent('PAGE_VIEW', 'user@example.com', 'Viewed dashboard');
 * logEvent('ROLE_UPDATE', 'admin@example.com', 'Changed user role from student to instructor');
 */
export function logEvent(type, userEmail = 'anonymous', details = '') {
  try {
    // Get existing logs from localStorage
    const existingLogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    // Create new log entry
    const entry = {
      type,                // e.g. LOGIN, LOGOUT, ROLE_UPDATE
      user: userEmail || 'anonymous',
      details,             // extra info (optional)
      time: new Date().toLocaleString(),
      timestamp: Date.now() // For sorting/filtering
    };
    
    // Add to logs array
    existingLogs.push(entry);
    
    // Store back to localStorage (limit to last 1000 entries to prevent storage bloat)
    const maxLogs = 1000;
    const trimmedLogs = existingLogs.slice(-maxLogs);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
    
    // Optional: Log to console in development
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      console.log('[Logger]', entry);
    }
  } catch (error) {
    // Handle localStorage errors (e.g., quota exceeded, private browsing)
    console.error('Failed to log event to localStorage:', error);
  }
}

/**
 * Retrieve the most recent N log entries
 * 
 * @param {number} [limit=10] - Maximum number of log entries to return
 * @returns {Array<Object>} Array of log entries, with most recent first
 * 
 * @example
 * const recentLogs = getLogs(20);
 * recentLogs.forEach(log => console.log(log.type, log.user, log.time));
 */
export function getLogs(limit = 10) {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Return latest entries first (reverse order)
    return logs.slice(-limit).reverse();
  } catch (error) {
    console.error('Failed to retrieve logs from localStorage:', error);
    return [];
  }
}

/**
 * Get all logs (without limit)
 * 
 * @returns {Array<Object>} Array of all log entries
 */
export function getAllLogs() {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return logs.reverse(); // Latest first
  } catch (error) {
    console.error('Failed to retrieve all logs from localStorage:', error);
    return [];
  }
}

/**
 * Clear all logs (for admin reset or cleanup)
 * 
 * @returns {boolean} True if logs were cleared successfully, false otherwise
 * 
 * @example
 * if (confirm('Clear all logs?')) {
 *   clearLogs();
 * }
 */
export function clearLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear logs from localStorage:', error);
    return false;
  }
}

/**
 * Get logs filtered by event type
 * 
 * @param {string} type - Event type to filter by
 * @param {number} [limit=10] - Maximum number of entries to return
 * @returns {Array<Object>} Filtered log entries
 * 
 * @example
 * const loginLogs = getLogsByType('LOGIN', 50);
 */
export function getLogsByType(type, limit = 10) {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = logs.filter(log => log.type === type);
    return filtered.slice(-limit).reverse();
  } catch (error) {
    console.error('Failed to filter logs from localStorage:', error);
    return [];
  }
}

/**
 * Get logs filtered by user email
 * 
 * @param {string} userEmail - User email to filter by
 * @param {number} [limit=10] - Maximum number of entries to return
 * @returns {Array<Object>} Filtered log entries
 * 
 * @example
 * const userLogs = getLogsByUser('user@example.com', 20);
 */
export function getLogsByUser(userEmail, limit = 10) {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = logs.filter(log => log.user === userEmail);
    return filtered.slice(-limit).reverse();
  } catch (error) {
    console.error('Failed to filter logs by user from localStorage:', error);
    return [];
  }
}

/**
 * Get the count of logs
 * 
 * @returns {number} Total number of log entries
 */
export function getLogCount() {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return logs.length;
  } catch (error) {
    console.error('Failed to get log count from localStorage:', error);
    return 0;
  }
}

