const express = require('express');
const router = express.Router();
const Center = require('../models/Center');
const User = require('../models/User');

// Get all centers
router.get('/', async (req, res) => {
  try {
    const centers = await Center.find({ isActive: true }).populate('userId', 'name email');
    res.json(centers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a center (Admin only)
router.post('/', async (req, res) => {
  console.log('Incoming Center Add Request:', req.body);
  try {
    const { centerName, ownerName, code, location, contactNumber, email } = req.body;

    // 1. Check if User already exists or create new one
    let user = await User.findOne({ mobile: contactNumber });
    
    if (!user) {
      user = new User({
        mobile: contactNumber,
        name: ownerName,
        email: email,
        role: 'center'
      });
      await user.save();
    } else {
      // Update existing user role to center if needed
      user.role = 'center';
      user.isActive = true;
      await user.save();
    }

    // 2. Check if Center with this code already exists
    const existingCenter = await Center.findOne({ code });
    if (existingCenter) {
      if (existingCenter.isActive) {
        return res.status(400).json({ message: 'Center with this code already exists and is active' });
      } else {
        // Reactivate existing center
        existingCenter.isActive = true;
        existingCenter.centerName = centerName;
        existingCenter.ownerName = ownerName;
        existingCenter.location = location;
        existingCenter.contactNumber = contactNumber;
        existingCenter.userId = user._id;
        await existingCenter.save();
        return res.status(201).json(existingCenter);
      }
    }

    // 3. Create New Center
    const center = new Center({
      centerName,
      ownerName,
      code,
      location,
      contactNumber,
      email,
      userId: user._id
    });

    const newCenter = await center.save();
    res.status(201).json(newCenter);
  } catch (err) {
    console.error('Server Center Add Error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update center
router.put('/:id', async (req, res) => {
  try {
    const center = await Center.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete (Deactivate) a center
router.delete('/:id', async (req, res) => {
  try {
    const Student = require('../models/Student');
    const studentCount = await Student.countDocuments({ center: req.params.id });
    
    if (studentCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete center. There are ${studentCount} students assigned to this center. Delete students first.` 
      });
    }

    const center = await Center.findByIdAndUpdate(req.params.id, { isActive: false });
    if (center && center.userId) {
      await User.findByIdAndUpdate(center.userId, { isActive: false });
    }
    res.json({ message: 'Center deactivated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
