const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ role: 'student' }).select('-otp');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Profile
router.put('/profile/:id', async (req, res) => {
  try {
    const { name, email, profilePicture } = req.body;
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
