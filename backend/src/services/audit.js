const AuditLog = require('../models/AuditLog');

async function audit(req, action, target, details) {
  try {
    await AuditLog.create({
      user: req.user ? req.user.id : undefined,
      action,
      target: target ? String(target) : undefined,
      details,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
    });
  } catch (err) {
    console.error('[audit] falha ao registrar:', err.message);
  }
}

module.exports = { audit };
