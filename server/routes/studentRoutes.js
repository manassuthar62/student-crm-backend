const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// Get all students (with filters for status and center)
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.centerId) filters.center = req.query.centerId;
    if (req.query.universityId) filters.university = req.query.universityId;

    const students = await Student.find(filters)
      .populate('center', 'centerName code')
      .populate('university', 'name code')
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student Registration
router.post('/register', async (req, res) => {
  try {
    const studentData = { ...req.body, status: 'registered' };
    const student = new Student(studentData);
    const newStudent = await student.save();

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
      .populate('university');
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
      .populate('university');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update student details
router.put('/:id', async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student updated successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
