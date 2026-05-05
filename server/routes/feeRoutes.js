const express = require('express');
const router = express.Router();
const FeeRecord = require('../models/FeeRecord');
const Student = require('../models/Student');

// Deposit Fee
router.post('/deposit', async (req, res) => {
  try {
    console.log('--- Fee Deposit Process Started ---');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    const { studentId, amount, paymentMode, remarks, recordedBy, referenceId } = req.body;

    if (!studentId || !amount) {
      return res.status(400).json({ message: 'Student ID and amount are required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      console.log('❌ Student not found:', studentId);
      return res.status(404).json({ message: 'Student not found' });
    }

    const totalPayable = (student.totalFees || 0) - (student.discount || 0);
    const alreadyPaid = student.paidFees || 0;
    const balance = totalPayable - alreadyPaid;

    if (balance <= 0) {
      return res.status(400).json({ success: false, message: 'Fees are already fully paid for this student' });
    }

    const depositAmount = Number(amount);
    if (depositAmount > balance) {
      return res.status(400).json({ success: false, message: `Cannot deposit more than remaining balance (Max: ₹${balance})` });
    }
    if (isNaN(depositAmount)) {
      return res.status(400).json({ message: 'Invalid amount provided' });
    }

    const Setting = require('../models/Setting');
    
    // 1. Generate Sequential Receipt Number
    let receiptNumber = '';
    try {
      const receiptSetting = await Setting.findOneAndUpdate(
        { key: 'nextReceiptNumber' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
      );
      if (receiptSetting) {
        receiptNumber = String(receiptSetting.value).padStart(4, '0');
      }
    } catch (e) {
      console.log('Error generating sequential receipt number, falling back to random');
      receiptNumber = String(Math.floor(Math.random() * 9000) + 1000);
    }

    const feeRecord = new FeeRecord({
      student: studentId,
      amount: depositAmount,
      paymentMode: paymentMode || 'Cash',
      receiptNumber,
      referenceId: referenceId || '',
      remarks: remarks || 'Fee Payment',
      recordedBy: recordedBy || 'Admin'
    });

    console.log('Saving Fee Record...');
    await feeRecord.save();
    console.log('✅ Fee Record saved');

    // 2. Update Student Balance
    student.paidFees = (student.paidFees || 0) + depositAmount;

    // 3. Update Installment Logic
    if (student.paymentPlan === 'Installment') {
      console.log('Redistributing Installments...');
      const totalInstallments = student.installments || 1;
      const totalPayable = (student.totalFees || 0) - (student.discount || 0);
      const currentBalance = totalPayable - student.paidFees;
      
      const currentNextAmount = student.nextInstallmentAmount || student.emiAmount || 0;
      
      // If this payment covers the current expected installment, increment the count
      if (depositAmount >= currentNextAmount) {
        student.installmentsPaidCount = (student.installmentsPaidCount || 0) + 1;
      }
      
      const remainingCount = totalInstallments - student.installmentsPaidCount;
      
      if (remainingCount > 0) {
        // Divide remaining balance among all remaining installments
        const newEmi = Math.ceil(currentBalance / remainingCount);
        student.emiAmount = newEmi;
        student.nextInstallmentAmount = newEmi;
      } else {
        // Last installment or beyond
        student.nextInstallmentAmount = currentBalance > 0 ? currentBalance : 0;
      }
      console.log('✅ Redistributed. New EMI:', student.emiAmount, 'Remaining:', remainingCount);
    }

    console.log('Saving Student updates...');
    await student.save();
    console.log('✅ Student updated successfully');

    res.status(201).json({ 
      success: true,
      message: 'Payment recorded successfully',
      feeRecord, 
      student 
    });
  } catch (err) {
    console.error('❌ FATAL DEPOSIT ERROR:', err);
    res.status(500).json({ 
      message: 'Internal Server Error while recording payment', 
      error: err.message,
      details: err.toString()
    });
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
