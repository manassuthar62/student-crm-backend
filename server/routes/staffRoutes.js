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

// Update staff
router.put('/:id', async (req, res) => {
  try {
    const { name, mobile, email, permissions, passcode, isActive } = req.body;
    const staffId = req.params.id;

    const user = await User.findById(staffId);
    if (!user) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Handle mobile change with uniqueness check
    if (mobile && mobile !== user.mobile) {
      const existing = await User.findOne({ mobile });
      if (existing) {
        return res.status(400).json({ message: 'Mobile number already in use' });
      }
      user.mobile = mobile;
    }

    // Update other fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (permissions !== undefined) user.permissions = permissions;
    if (passcode !== undefined) user.passcode = passcode;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json(user);
  } catch (err) {
    console.error('❌ Update Staff Error:', err);
    res.status(500).json({ message: 'Internal Server Error: ' + err.message });
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
