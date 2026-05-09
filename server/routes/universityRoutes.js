const express = require('express');
const router = express.Router();
const University = require('../models/University');
const { auth, adminOnly } = require('../middleware/auth');

// Get all universities (Publicly accessible but requires auth)
router.get('/', auth, async (req, res) => {
  try {
    const universities = await University.find({ isActive: true });
    res.json(universities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a university (Admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  const university = new University({
    name: req.body.name,
    code: req.body.code,
    description: req.body.description
  });

  try {
    const newUniversity = await university.save();
    res.status(201).json(newUniversity);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a university (Admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const university = await University.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(university);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete (Deactivate) a university (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const studentCount = await Student.countDocuments({ university: req.params.id });

    if (studentCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete university. There are ${studentCount} students enrolled. Delete students first.` 
      });
    }

    await University.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'University deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
