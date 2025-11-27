/**
 * UUID validation utility for frontend
 * Can be used in both module and non-module contexts
 */
export function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Also expose as global for non-module scripts
if (typeof window !== 'undefined') {
  window.isValidUUID = isValidUUID;
}

