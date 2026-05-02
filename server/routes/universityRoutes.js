const express = require('express');
const router = express.Router();
const University = require('../models/University');

// Get all universities
router.get('/', async (req, res) => {
  try {
    const universities = await University.find({ isActive: true });
    res.json(universities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a university (Admin only)
router.post('/', async (req, res) => {
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

// Update a university
router.put('/:id', async (req, res) => {
  try {
    const university = await University.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(university);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete (Deactivate) a university
router.delete('/:id', async (req, res) => {
  try {
    await University.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'University deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
