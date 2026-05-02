const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Simple placeholders for now since we haven't copied controllers yet
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/firebase-login', authController.firebaseLogin);
router.post('/send-email-otp', authController.sendEmailOTP);
router.post('/verify-email-otp', authController.verifyEmailOTP);

module.exports = router;
