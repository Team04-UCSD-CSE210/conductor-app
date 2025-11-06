// js/logger.js
/**
 * Logger utility — tracks key events in localStorage for auditing
 */

export function logEvent(type, userEmail, details = "") {
  const logs = JSON.parse(localStorage.getItem("systemLogs")) || [];
  const entry = {
    type,                // e.g. LOGIN, LOGOUT, ROLE_UPDATE
    user: userEmail || "anonymous",
    details,             // extra info (optional)
    time: new Date().toLocaleString()
  };
  logs.push(entry);
  localStorage.setItem("systemLogs", JSON.stringify(logs));
}

/**
 * Retrieve the most recent N log entries.
 */
export function getLogs(limit = 10) {
  const logs = JSON.parse(localStorage.getItem("systemLogs")) || [];
  return logs.slice(-limit).reverse(); // show latest first
}

/**
 * Clear all logs (for admin reset)
 */
export function clearLogs() {
  localStorage.removeItem("systemLogs");
}

