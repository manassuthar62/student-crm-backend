const mongoose = require('mongoose');

const feeRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Online', 'Cheque', 'UPI'],
    default: 'Cash'
  },
  receiptNumber: {
    type: String,
    unique: true,
    required: true
  },
  referenceId: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FeeRecord', feeRecordSchema);
