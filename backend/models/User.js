const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true // Allows legacy null values while enforcing uniqueness for new emails
  },
  avatar: {
    type: String
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false // Requires OTP verification for new registrations
  },
  otpCode: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  videoExportQuota: {
    type: Number,
    default: 10
  },
  videoExportUsed: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
