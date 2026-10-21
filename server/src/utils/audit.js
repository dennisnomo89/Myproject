const { AuditLog } = require('../models');

// Records who did what. Failures are logged but never break the request.
async function audit(req, action, details) {
  try {
    await AuditLog.create({
      UserId: req.user ? req.user.id : null,
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = audit;
