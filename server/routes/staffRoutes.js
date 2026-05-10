const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');

// Get all centers (formerly staff)
router.get('/', auth, async (req, res) => {
  try {
    // Admin sees all, but we find both roles for backward compatibility
    const centers = await User.find({ role: { $in: ['staff', 'center'] } });
    res.json(centers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new center
router.post('/', auth, adminOnly, async (req, res) => {
  const { name, mobile, email, permissions, passcode } = req.body;
  
  try {
    let user = await User.findOne({ mobile });
    if (user) {
      return res.status(400).json({ message: 'User with this mobile already exists' });
    }

    user = new User({
      name,
      mobile,
      email: email || `${mobile}@center.com`,
      role: 'center', // Standardize to center
      permissions: permissions || [],
      passcode: passcode || '123456',
      isActive: true
    });

    await user.save();
    console.log(`✅ Center created successfully: ${name}`);
    res.status(201).json(user);
  } catch (err) {
    console.error('❌ Error creating center:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Update center
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, mobile, email, permissions, passcode, isActive, role } = req.body;
    const centerId = req.params.id;

    const user = await User.findById(centerId);
    if (!user) {
      return res.status(404).json({ message: 'Center not found' });
    }

    if (mobile && mobile !== user.mobile) {
      const existing = await User.findOne({ mobile });
      if (existing) {
        return res.status(400).json({ message: 'Mobile number already in use' });
      }
      user.mobile = mobile;
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (permissions !== undefined) user.permissions = permissions;
    if (passcode !== undefined) user.passcode = passcode;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;

    await user.save();
    res.json(user);
  } catch (err) {
    console.error('❌ Update Center Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete center
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Center deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
