const mongoose = require('mongoose');

const CookieSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  cookie: { type: String, required: true },
  status: { type: String, default: 'active' },
  errorCount: { type: Number, default: 0 },
  lastUsed: { type: Date, default: () => new Date(0) },
  useCount: { type: Number, default: 0 },
  label: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.Cookie || mongoose.model('Cookie', CookieSchema);
