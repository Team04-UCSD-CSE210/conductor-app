// Validation utility functions

/**
 * Check if a string is a valid UUID v4
 * @param {string} v - Value to check
 * @returns {boolean} True if valid UUID
 */
export function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

