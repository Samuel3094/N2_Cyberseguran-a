const { Schema, model } = require('mongoose');

// Trilha de auditoria (apoia o não repúdio): quem fez o quê, quando e de onde.
const auditSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  target: String,
  details: Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  at: { type: Date, default: Date.now, index: true },
});

module.exports = model('AuditLog', auditSchema);
