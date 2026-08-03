const mongoose = require('mongoose');

const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  status: { type: String, default: 'active' },
  errorCount: { type: Number, default: 0 },
  lastUsed: { type: Date, default: () => new Date(0) },
  useCount: { type: Number, default: 0 },
  dailyUseCount: { type: Number, default: 0 },
  dailyLimit: { type: Number, default: 1500 },
  provider: { type: String, default: 'gemini' },
  project: { type: String, default: 'resub' },
  label: { type: String, default: '' },
  tags: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.models.Key || mongoose.model('Key', KeySchema);
