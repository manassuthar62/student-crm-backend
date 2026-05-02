const express = require('express');
const router = express.Router();
const FeeRecord = require('../models/FeeRecord');
const Student = require('../models/Student');

// Deposit Fee
router.post('/deposit', async (req, res) => {
  try {
    const { studentId, amount, paymentMode, remarks, recordedBy, referenceId } = req.body;

    // 1. Create Fee Record
    const receiptNumber = 'REC' + Date.now();
    const feeRecord = new FeeRecord({
      student: studentId,
      amount,
      paymentMode,
      receiptNumber,
      referenceId,
      remarks,
      recordedBy
    });
    await feeRecord.save();

    // 2. Update Student Balance
    const student = await Student.findByIdAndUpdate(
      studentId,
      { $inc: { paidFees: amount } },
      { new: true }
    );

    res.status(201).json({ feeRecord, student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Apply Discount
router.post('/discount', async (req, res) => {
  try {
    const { studentId, discountAmount, remarks } = req.body;

    const student = await Student.findByIdAndUpdate(
      studentId,
      { $inc: { discount: discountAmount } },
      { new: true }
    );

    if (!student) return res.status(404).json({ message: 'Student not found' });

    res.json({ message: 'Discount applied successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get Fee Records for a Student
router.get('/student/:studentId', async (req, res) => {
  try {
    let records = await FeeRecord.find({ student: req.params.studentId }).sort({ createdAt: -1 });
    const student = await Student.findById(req.params.studentId);

    if (student && student.paidFees > 0) {
      // Calculate total amount in existing FeeRecords
      const recordedTotal = records.reduce((sum, r) => sum + r.amount, 0);
      
      // If there's a gap (legacy data), add the virtual initial record
      if (recordedTotal < student.paidFees) {
        records.push({
          _id: student._id + '_initial',
          student: student._id,
          amount: student.paidFees - recordedTotal,
          paymentDate: student.createdAt,
          paymentMode: student.paymentMethod || 'Cash',
          receiptNumber: 'ADMISSION-' + student._id.toString().slice(-4).toUpperCase(),
          remarks: 'Initial Admission Payment',
          referenceId: student.referenceId
        });
      }
    }
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Payment Report (Admin/Center)
router.get('/report', async (req, res) => {
  try {
    const { centerId } = req.query;
    let query = {};
    
    if (centerId) {
      // Find students in this center first
      const students = await Student.find({ center: centerId }).select('_id');
      const studentIds = students.map(s => s._id);
      query.student = { $in: studentIds };
    }

    const reports = await FeeRecord.find(query)
      .populate({
        path: 'student',
        select: 'name enrollmentNumber center',
        populate: { path: 'center', select: 'centerName code' }
      })
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Single Fee Record
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Handle Virtual Initial Receipt
    if (id.endsWith('_initial')) {
      const studentId = id.split('_initial')[0];
      const student = await Student.findById(studentId).populate('university');
      if (!student) return res.status(404).json({ message: 'Student not found' });
      
      return res.json({
        _id: id,
        student: student,
        amount: student.paidFees,
        paymentDate: student.createdAt,
        paymentMode: student.paymentMethod || 'Cash',
        receiptNumber: 'ADMISSION-' + student._id.toString().slice(-4).toUpperCase(),
        remarks: 'Initial Admission Payment',
        referenceId: student.referenceId
      });
    }

    const record = await FeeRecord.findById(id).populate({
      path: 'student',
      populate: { path: 'university' }
    });
    
    if (!record) return res.status(404).json({ message: 'Receipt not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
