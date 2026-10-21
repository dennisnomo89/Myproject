// Slows down password guessing (SRS 4.2). Limits are counted per IP address and email address.
const { rateLimit } = require('express-rate-limit');
const config = require('../config');

const WINDOW_MS = 15 * 60 * 1000;
const emailOf = (req) => String((req.body && req.body.email) || '').trim().toLowerCase();

// Failed sign-ins for one email from one address. Successful sign-ins don't count.
function createLoginLimiter({ limit = config.rateLimit.loginPerWindow, windowMs = WINDOW_MS } = {}) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${req.ip}|${emailOf(req)}`,
    message: { message: 'Too many failed sign-in attempts. Please wait 15 minutes and try again, or reset your password.' },
  });
}

// Password reset requests from one address (each email is also limited to 3 an hour in the controller).
function createResetLimiter({ limit = config.rateLimit.resetPerWindow, windowMs = WINDOW_MS } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many password reset requests. Please wait 15 minutes and try again.' },
  });
}

const passThrough = (req, res, next) => next();

module.exports = {
  createLoginLimiter,
  createResetLimiter,
  loginLimiter: config.rateLimit.enabled ? createLoginLimiter() : passThrough,
  resetLimiter: config.rateLimit.enabled ? createResetLimiter() : passThrough,
};
