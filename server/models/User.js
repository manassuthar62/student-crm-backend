const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  mobile: {
    type: String,
    unique: true,
    trim: true,
    sparse: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['student', 'admin', 'center', 'staff'],
    default: 'student'
  },
  permissions: {
    type: [String], // e.g., ['students', 'fees', 'reports', 'verification']
    default: []
  },
  passcode: {
    type: String,
    default: null
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
