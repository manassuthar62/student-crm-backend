const User = require('../models/User');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const nodemailer = require('nodemailer');

// Mock transporter (You should add real SMTP details in .env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, role: 'student', otp, otpExpiry });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    }

    // Send Real Email (If credentials provided)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail({
        from: `"Tech Flow Education" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Login OTP',
        text: `Your OTP for Tech Flow Education is ${otp}. Valid for 10 minutes.`
      });
    }

    console.log(`OTP for ${email}: ${otp}`); // Logged for testing if email fails
    res.json({ message: 'OTP sent to email', testOtp: !process.env.EMAIL_PASS ? otp : undefined });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email, otp, otpExpiry: { $gt: Date.now() } });

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: user._id, email: user.email, role: user.role, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.firebaseLogin = async (req, res) => {
  try {
    const { idToken, name } = req.body;
    if (!idToken) return res.status(400).json({ message: 'ID Token is required' });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { phone_number: mobile, email, name: tokenName } = decodedToken;

    if (!mobile && !email) {
      return res.status(400).json({ message: 'No contact information found in token' });
    }

    let user;
    if (mobile) {
      user = await User.findOne({ mobile });
    } else if (email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      user = await User.create({ 
        mobile: mobile || undefined, 
        email: email || undefined,
        name: name || tokenName || '' 
      });
    } else {
      if ((name || tokenName) && !user.name) {
        user.name = name || tokenName;
        await user.save();
      }
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        mobile: user.mobile,
        role: user.role,
        name: user.name
      }
    });
  } catch (err) {
    console.error('Firebase Login Error:', err);
    res.status(401).json({ message: 'Unauthorized or invalid token' });
  }
};

exports.login = async (req, res) => res.status(400).json({ message: 'Use Firebase login' });
exports.verifyOTP = async (req, res) => res.status(400).json({ message: 'Use Firebase login' });
exports.resendOTP = async (req, res) => res.status(400).json({ message: 'Use Firebase login' });
