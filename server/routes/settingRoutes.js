const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

// Get a setting by key
router.get('/:key', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update or create a setting
router.post('/', async (req, res) => {
  const { key, value } = req.body;
  try {
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
