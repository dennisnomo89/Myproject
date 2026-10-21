class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wraps an async route handler so rejected promises reach the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, asyncHandler };
