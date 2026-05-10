const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');

// Get all users (Admin only)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'student' }).select('-otp');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Profile
router.put('/profile/:id', auth, async (req, res) => {
  try {
    const { name, email, profilePicture } = req.body;
    
    // Only allow updating own profile unless admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Unauthorized to update this profile' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, email, profilePicture } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
