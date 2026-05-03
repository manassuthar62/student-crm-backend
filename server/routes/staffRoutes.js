const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all staff
router.get('/', async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new staff
router.post('/', async (req, res) => {
  const { name, mobile, email, permissions, passcode } = req.body;
  
  try {
    // Check if user already exists
    let user = await User.findOne({ mobile });
    if (user) {
      return res.status(400).json({ message: 'User with this mobile already exists' });
    }

    user = new User({
      name,
      mobile,
      email: email || `${mobile}@staff.com`,
      role: 'staff',
      permissions: permissions || [],
      passcode: passcode || '123456',
      isActive: true
    });

    await user.save();
    console.log(`✅ Staff created successfully: ${name}`);
    res.status(201).json(user);
  } catch (err) {
    console.error('❌ Error creating staff:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Update staff permissions
router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Staff not found' });

    if (req.body.permissions) user.permissions = req.body.permissions;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    if (req.body.name) user.name = req.body.name;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete staff
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
