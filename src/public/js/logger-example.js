/**
 * Example usage of the logger module
 * 
 * This file demonstrates how to use the logger in your HTML pages
 */

// Import the logger functions (when using ES modules)
// import { logEvent, getLogs, clearLogs } from './logger.js';

// Example: Log a login event
// logEvent('LOGIN', 'user@example.com', 'User logged in via Google OAuth');

// Example: Log a page view
// logEvent('PAGE_VIEW', 'user@example.com', 'Viewed dashboard page');

// Example: Log a role update
// logEvent('ROLE_UPDATE', 'admin@example.com', 'Changed user role from student to instructor');

// Example: Get recent logs
// const recentLogs = getLogs(10);
// console.log('Recent logs:', recentLogs);

// Example: Clear all logs (with confirmation)
// if (confirm('Clear all logs?')) {
//   clearLogs();
//   console.log('Logs cleared');
// }

// Example: Log events automatically on page load
// window.addEventListener('load', () => {
//   const userEmail = document.getElementById('user-email')?.textContent || 'anonymous';
//   logEvent('PAGE_VIEW', userEmail, `Viewed ${window.location.pathname}`);
// });

// Example: Log logout events
// document.getElementById('logout-btn')?.addEventListener('click', () => {
//   const userEmail = document.getElementById('user-email')?.textContent || 'anonymous';
//   logEvent('LOGOUT', userEmail, 'User clicked logout button');
// });
