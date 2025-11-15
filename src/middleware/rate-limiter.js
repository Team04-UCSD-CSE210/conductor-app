/**
 * Rate limiting middleware for API endpoints
 * Prevents abuse and ensures fair resource usage
 *
 * Note: Uses in-memory storage. For production with multiple instances,
 * consider using Redis or similar distributed cache.
 */
const rateLimitStore = new Map();

/**
 * Creates a rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests per window
 * @returns {Function} Express middleware
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    maxRequests = 100, // 100 requests per window default
  } = options;

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      // 1% chance to clean up on each request
      for (const [k, v] of rateLimitStore.entries()) {
        if (now - v.resetTime > windowMs) {
          rateLimitStore.delete(k);
        }
      }
    }

    const record = rateLimitStore.get(key);

    if (!record || now - record.resetTime > windowMs) {
      // New window or expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((windowMs - (now - record.resetTime)) / 1000);
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }

    // Increment counter
    record.count++;
    next();
  };
}

/**
 * Rate limiter specifically for roster import endpoints
 * More restrictive due to resource-intensive operations
 */
export const rosterImportLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 imports per 15 minutes
});

/**
 * Rate limiter for general API endpoints
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

