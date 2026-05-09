const express = require('express');
const router = express.Router();
const FeeRecord = require('../models/FeeRecord');
const Student = require('../models/Student');
const { auth } = require('../middleware/auth');

// Deposit Fee
router.post('/deposit', auth, async (req, res) => {
  try {
    console.log('--- Fee Deposit Process Started ---');
    
    const { studentId, amount, paymentMode, remarks, referenceId } = req.body;

    if (!studentId || !amount) {
      return res.status(400).json({ message: 'Student ID and amount are required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // SECURITY CHECK: Center can only collect fees for their own students
    if (req.user.role !== 'admin' && String(student.addedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized: You can only collect fees for your own students' });
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
      receiptNumber = String(Math.floor(Math.random() * 9000) + 1000);
    }

    const feeRecord = new FeeRecord({
      student: studentId,
      amount: depositAmount,
      paymentMode: paymentMode || 'Cash',
      receiptNumber,
      referenceId: referenceId || '',
      remarks: remarks || 'Fee Payment',
      recordedBy: req.user.name // Use name from token
    });

    await feeRecord.save();

    // 2. Update Student Balance
    student.paidFees = (student.paidFees || 0) + depositAmount;

    // 3. Update Installment Logic
    if (student.paymentPlan === 'Installment') {
      const totalInstallments = student.installments || 1;
      const totalPayable = (student.totalFees || 0) - (student.discount || 0);
      const currentBalance = totalPayable - student.paidFees;
      const currentNextAmount = student.nextInstallmentAmount || student.emiAmount || 0;
      
      if (depositAmount >= currentNextAmount) {
        student.installmentsPaidCount = (student.installmentsPaidCount || 0) + 1;
      }
      
      const remainingCount = totalInstallments - student.installmentsPaidCount;
      if (remainingCount > 0) {
        const newEmi = Math.ceil(currentBalance / remainingCount);
        student.emiAmount = newEmi;
        student.nextInstallmentAmount = newEmi;
      } else {
        student.nextInstallmentAmount = currentBalance > 0 ? currentBalance : 0;
      }
    }

    await student.save();
    res.status(201).json({ success: true, message: 'Payment recorded successfully', feeRecord, student });
  } catch (err) {
    console.error('❌ FATAL DEPOSIT ERROR:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});

// Apply Discount
router.post('/discount', auth, async (req, res) => {
  try {
    const { studentId, discountAmount, remarks } = req.body;
    
    // SECURITY CHECK: Center can only apply discount for their own students
    const studentCheck = await Student.findById(studentId);
    if (!studentCheck) return res.status(404).json({ message: 'Student not found' });
    
    if (req.user.role !== 'admin' && String(studentCheck.addedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized: You can only apply discounts for your own students' });
    }

    const student = await Student.findByIdAndUpdate(
      studentId,
      { $inc: { discount: discountAmount }, discountRemark: remarks },
      { new: true }
    );

    res.json({ message: 'Discount applied successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get Fee Records for a Student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // SECURITY CHECK
    if (req.user.role !== 'admin' && String(student.addedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized: Access denied to these records' });
    }

    let records = await FeeRecord.find({ student: req.params.studentId }).sort({ createdAt: -1 });

    if (student.paidFees > 0) {
      const recordedTotal = records.reduce((sum, r) => sum + r.amount, 0);
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

// Payment Report (Separated by Center)
router.get('/report', auth, async (req, res) => {
  try {
    let query = {};
    
    // If not admin, only show students added by this center
    if (req.user.role !== 'admin') {
      const students = await Student.find({ addedBy: req.user._id }).select('_id');
      const studentIds = students.map(s => s._id);
      query.student = { $in: studentIds };
    } else {
      // Admin can filter by specific centerId if provided
      const { centerId } = req.query;
      if (centerId) {
        const students = await Student.find({ center: centerId }).select('_id');
        const studentIds = students.map(s => s._id);
        query.student = { $in: studentIds };
      }
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
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    let record;

    // Handle Virtual Initial Receipt
    if (id.endsWith('_initial')) {
      const studentId = id.split('_initial')[0];
      const student = await Student.findById(studentId).populate('university');
      if (!student) return res.status(404).json({ message: 'Student not found' });
      
      record = {
        _id: id,
        student: student,
        amount: student.paidFees,
        paymentDate: student.createdAt,
        paymentMode: student.paymentMethod || 'Cash',
        receiptNumber: 'ADMISSION-' + student._id.toString().slice(-4).toUpperCase(),
        remarks: 'Initial Admission Payment',
        referenceId: student.referenceId
      };
    } else {
      record = await FeeRecord.findById(id).populate({
        path: 'student',
        populate: { path: 'university' }
      });
    }
    
    if (!record) return res.status(404).json({ message: 'Receipt not found' });

    // SECURITY CHECK
    const studentData = record.student;
    if (req.user.role !== 'admin' && String(studentData.addedBy || studentData) !== String(req.user._id)) {
      // Note: for initial receipt, studentData IS the student object. For normal, it's populated.
      const addedBy = studentData.addedBy || studentData._id; // fallback logic
      // Actually if it's already populated, we check record.student.addedBy
      const studentAddedBy = record.student.addedBy ? String(record.student.addedBy) : String(record.student);
      if (req.user.role !== 'admin' && studentAddedBy !== String(req.user._id)) {
         return res.status(403).json({ message: 'Unauthorized access to this receipt' });
      }
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
