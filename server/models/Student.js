const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  fatherName: {
    type: String,
    required: true,
    trim: true
  },
  motherName: {
    type: String,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  course: {
    type: String,
    required: true,
    trim: true
  },
  session: {
    type: String,
    required: true,
    trim: true
  },
  university: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'University',
    required: true
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: false
  },
  photo: {
    type: String, // URL to photo
    default: ''
  },
  status: {
    type: String,
    enum: ['registered', 'verified', 'enrolled', 'rejected'],
    default: 'registered'
  },
  enrollmentNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  totalFees: {
    type: Number,
    default: 0
  },
  paidFees: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  address: {
    type: String,
    trim: true
  },
  alternateMobile: {
    type: String,
    trim: true
  },
  paymentPlan: {
    type: String,
    default: 'One Time'
  },
  installments: {
    type: Number,
    default: 1
  },
  nextDueDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  referenceId: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);
