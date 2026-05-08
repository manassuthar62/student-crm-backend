const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const FeeRecord = require('../models/FeeRecord');

// Get all students (with filters for status and center)
router.get('/', async (req, res) => {
  try {
    const filters = {};
    const { status, centerId, universityId, userId, role } = req.query;

    if (status) filters.status = status;
    if (centerId) filters.center = centerId;
    if (universityId) filters.university = universityId;

    console.log('🔍 Filter Request:', { role, userId });
    let query = { ...filters };

    // Filter by staff if role is staff
    if (role && role.toLowerCase() === 'staff' && userId) {
      query.addedBy = userId;
    }
    console.log('✅ Final Query:', query);

    const students = await Student.find(query)
      .populate('center', 'centerName code')
      .populate('university', 'name code')
      .populate('addedBy', 'name')
      .populate('registeredBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// TEMPORARY: Fix EMIs for all students
router.get('/fix-emis-data', async (req, res) => {
  try {
    const students = await Student.find({ paymentPlan: 'Installment' });
    let count = 0;
    
    for (let student of students) {
      const totalInstallments = student.installments || 1;
      const paidCount = student.installmentsPaidCount || 0;
      const remainingInstallments = totalInstallments - paidCount;
      
      if (remainingInstallments > 0) {
        const totalFees = Number(student.totalFees) || 0;
        const discount = Number(student.discount) || 0;
        const paidFees = Number(student.paidFees) || 0;
        const remainingToPay = (totalFees - discount) - paidFees;
        
        const emi = Math.ceil(remainingToPay / remainingInstallments);
        student.emiAmount = emi;
        student.nextInstallmentAmount = emi;
        await student.save();
        count++;
      }
    }
    res.json({ message: `Successfully fixed EMIs for ${count} students` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student Registration
router.post('/register', async (req, res) => {
  try {
    const studentData = { ...req.body, status: 'registered' };
    
    // Calculate EMI if it's an installment plan
    if (studentData.paymentPlan === 'Installment' && studentData.installments > 0) {
      const totalToPay = (Number(studentData.totalFees) || 0) - (Number(studentData.discount) || 0) - (Number(studentData.paidFees) || 0);
      const emi = Math.ceil(totalToPay / studentData.installments);
      studentData.emiAmount = emi;
      studentData.nextInstallmentAmount = emi;
    }

    const student = new Student(studentData);
    const newStudent = await (await student.save()).populate(['addedBy', 'registeredBy']);

    // Create initial fee record if payment was made during registration
    if (newStudent.paidFees > 0) {
      const FeeRecord = require('../models/FeeRecord');
      const receiptNumber = 'REC' + Date.now();
      const initialFee = new FeeRecord({
        student: newStudent._id,
        amount: newStudent.paidFees,
        paymentMode: newStudent.paymentMethod || 'Cash',
        receiptNumber: receiptNumber,
        referenceId: newStudent.referenceId,
        remarks: 'Initial payment during registration'
      });
      await initialFee.save();
    }

    res.status(201).json(newStudent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 1. Verify Student (Admin only)
router.put('/verify/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    student.status = 'verified';
    await student.save();
    res.json({ message: 'Student verified successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 2. Enroll Student (Admin only - Generates Enrollment Number)
router.put('/enroll/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('university');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (student.status !== 'verified') {
      return res.status(400).json({ message: 'Student must be verified before enrollment' });
    }

    // Logic for enrollment number: UNIV_CODE + YEAR + RANDOM_ID
    const universityCode = student.university ? student.university.code : 'UNIV';
    const year = new Date().getFullYear().toString().slice(-2);
    const randomPart = Math.floor(10000 + Math.random() * 90000); // 5 digit random
    
    student.enrollmentNumber = `${universityCode}${year}${randomPart}`;
    student.status = 'enrolled';

    await student.save();
    res.json({ message: 'Student enrolled successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get single student by ID
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('center')
      .populate('university')
      .populate('addedBy', 'name')
      .populate('registeredBy', 'name role');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get student by Mobile Number (for mobile app)
router.get('/mobile/:mobile', async (req, res) => {
  try {
    const student = await Student.findOne({ mobile: req.params.mobile })
      .populate('center')
      .populate('university')
      .populate('registeredBy', 'name role');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update student details
router.put('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Update fields
    Object.assign(student, req.body);

    // Recalculate EMI if it's an installment plan
    if (student.paymentPlan === 'Installment') {
      const totalInstallments = student.installments || 1;
      const paidCount = student.installmentsPaidCount || 0;
      const remainingInstallments = totalInstallments - paidCount;
      
      if (remainingInstallments > 0) {
        const totalFees = Number(student.totalFees) || 0;
        const discount = Number(student.discount) || 0;
        const paidFees = Number(student.paidFees) || 0;
        const remainingToPay = (totalFees - discount) - paidFees;
        
        const emi = Math.ceil(remainingToPay / remainingInstallments);
        student.emiAmount = emi;
        student.nextInstallmentAmount = emi;
      } else {
        // No remaining installments, set to balance
        const totalFees = Number(student.totalFees) || 0;
        const discount = Number(student.discount) || 0;
        const paidFees = Number(student.paidFees) || 0;
        const balance = (totalFees - discount) - paidFees;
        student.nextInstallmentAmount = balance > 0 ? balance : 0;
      }
    }

    await student.save();

    // Create initial fee record if it doesn't exist and payment is now > 0
    const existingFees = await FeeRecord.findOne({ student: student._id });
    if (!existingFees && student.paidFees > 0) {
      const receiptNumber = 'REC' + Date.now();
      const initialFee = new FeeRecord({
        student: student._id,
        amount: student.paidFees,
        paymentMode: student.paymentMethod || 'Cash',
        receiptNumber: receiptNumber,
        referenceId: student.referenceId,
        remarks: 'Initial payment recorded during update'
      });
      await initialFee.save();
    }

    res.json({ message: 'Student updated successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE student
router.delete('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // 1. Delete all related fee records first
    await FeeRecord.deleteMany({ student: studentId });
    
    // 2. Delete the student
    const student = await Student.findByIdAndDelete(studentId);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    res.json({ message: 'Student and related records deleted successfully' });
  } catch (err) {
    console.error('❌ Delete Student Error:', err);
    res.status(500).json({ message: 'Internal Server Error: ' + err.message });
  }
});

module.exports = router;
