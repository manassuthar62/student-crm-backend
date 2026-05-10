const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const FeeRecord = require('../models/FeeRecord');
const { auth } = require('../middleware/auth');

const isCenterRole = (user) => ['center', 'staff'].includes(user.role?.toLowerCase());
const canAccessStudent = (user, student) => {
  if (user.role === 'admin') return true;
  if (!isCenterRole(user) || !student) return false;

  const userId = String(user._id);
  const addedBy = student.addedBy?._id || student.addedBy;
  const center = student.center?._id || student.center;
  const registeredBy = student.registeredBy?._id || student.registeredBy;

  return [addedBy, center, registeredBy].some((value) => value && String(value) === userId);
};

// Get all students (with filters and data separation)
router.get('/', auth, async (req, res) => {
  try {
    const filters = {};
    const { status, centerId, universityId } = req.query;

    if (status) filters.status = status;
    if (centerId) filters.center = centerId;
    if (universityId) filters.university = universityId;

    const userRole = req.user.role?.toLowerCase();
    let query = { ...filters };

    // DATA SEPARATION: If role is center/staff, only show their own students
    if (userRole === 'center' || userRole === 'staff') {
      query.$or = [
        { addedBy: req.user._id },
        { center: req.user._id }
      ];
    }

    const students = await Student.find(query)
      .populate('center', 'centerName code')
      .populate('university', 'name code')
      .populate('addedBy', 'name')
      .populate('registeredBy', 'name role')
      .sort({ createdAt: -1 });

    console.log(`🔍 Students fetched for ${req.user.name} (${userRole}). Found ${students.length} students.`);
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Student Registration
router.post('/register', auth, async (req, res) => {
  try {
    const studentData = { ...req.body, status: 'registered' };
    
    // Auto-set addedBy and registeredBy from token
    studentData.registeredBy = req.user._id;
    if (req.user.role === 'center' || req.user.role === 'staff') {
      studentData.addedBy = req.user._id;
    }

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
router.put('/verify/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    student.status = 'verified';
    await student.save();
    res.json({ message: 'Student verified successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 2. Enroll Student (Admin only)
router.put('/enroll/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const student = await Student.findById(req.params.id).populate('university');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (student.status !== 'verified') {
      return res.status(400).json({ message: 'Student must be verified before enrollment' });
    }

    const universityCode = student.university ? student.university.code : 'UNIV';
    const year = new Date().getFullYear().toString().slice(-2);
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    
    student.enrollmentNumber = `${universityCode}${year}${randomPart}`;
    student.status = 'enrolled';

    await student.save();
    res.json({ message: 'Student enrolled successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get single student by ID (with ownership check)
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('center')
      .populate('university')
      .populate('addedBy', 'name')
      .populate('registeredBy', 'name role');
    
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Ownership check
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({ message: 'You do not have permission to view this student' });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update student details (with ownership check)
router.put('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Ownership check
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({ message: 'You do not have permission to update this student' });
    }

    Object.assign(student, req.body);

    // Recalculate EMI
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
      }
    }

    await student.save();
    res.json({ message: 'Student updated successfully', student });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE student (with ownership check)
router.delete('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Ownership check
    if (!canAccessStudent(req.user, student)) {
      return res.status(403).json({ message: 'You do not have permission to delete this student' });
    }

    await FeeRecord.deleteMany({ student: req.params.id });
    await Student.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
