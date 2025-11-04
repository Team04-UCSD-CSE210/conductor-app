// apps/api/utils/errors.js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const notFound = (req, res) => {
  res.status(404).json({ error: true, message: `Not found: ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: true, message: err.message });
};
