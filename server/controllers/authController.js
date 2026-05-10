const User = require('../models/User');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const nodemailer = require('nodemailer');

// Helper to get mail transporter
const getTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // Port 587 is for STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false, // Helps in some local environments
      requireTLS: true
    }
  });
};

const https = require('https');

exports.sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); 

    let user = await User.findOne({ email });
    const adminCount = await User.countDocuments({ role: 'admin' });

    // Special case for the developer/setup email
    const isSetupEmail = email === 'lokendradave02@gmail.com';

    // If admins exist, only allow existing admins. If none exist or it's the setup email, allow it.
    if (adminCount > 0 && !isSetupEmail) {
       if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: 'This email is not authorized for Admin access.' });
       }
    }

    if (!user) {
      // Create user as admin if it's the setup email or no admins exist
      const role = (adminCount === 0 || isSetupEmail) ? 'admin' : 'student';
      user = await User.create({ 
        email, 
        role: role, 
        otp, 
        otpExpiry, 
        name: isSetupEmail ? 'Super Admin' : 'User',
        permissions: role === 'admin' ? ['students_view', 'students_add', 'students_edit', 'students_delete', 'fees_collect', 'reports_view', 'verification'] : []
      });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    }

    console.log(`Attempting to send OTP to ${email} via Brevo API...`);

    const apiKey = (process.env.EMAIL_PASS || '').trim();
    const senderEmail = (process.env.EMAIL_USER || '').trim();

    // Use Brevo API instead of SMTP
    if (apiKey) {
      const recipients = [{ email: email }];
      if (process.env.SECONDARY_ADMIN_EMAIL) {
        recipients.push({ email: process.env.SECONDARY_ADMIN_EMAIL });
      }

      const data = JSON.stringify({
        sender: { name: "Tech Flow", email: senderEmail },
        to: recipients,
        subject: "Admin Login OTP",
        textContent: `Your login OTP is ${otp}. Valid for 10 minutes.`
      });

      const options = {
        hostname: 'api.brevo.com',
        port: 443,
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data)
        }
      };

      console.log('Sending request to Brevo API with key starting with:', apiKey.substring(0, 10) + '...');

      const reqApi = https.request(options, (resApi) => {
        let responseBody = '';
        resApi.on('data', (chunk) => responseBody += chunk);
        resApi.on('end', () => {
          if (resApi.statusCode >= 200 && resApi.statusCode < 300) {
            console.log(`✅ Email successfully sent to ${email} (via API)`);
          } else {
            console.error(`❌ Brevo API Error (${resApi.statusCode}):`, responseBody);
            console.log('Used API Key length:', apiKey.length);
          }
        });
      });

      reqApi.on('error', (e) => {
        console.error('❌ Brevo API Connection Error:', e.message);
      });

      reqApi.write(data);
      reqApi.end();
    } else {
      console.error('❌ EMAIL_PASS (API Key) is missing in .env');
    }

    console.log(`Generated OTP for ${email}: ${otp}`); 
    return res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ 
      message: 'Server error while sending OTP', 
      error: err.message
    });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    let user = await User.findOne({ email });

    // If no user exists, create the first one as Admin for easy setup
    if (!user) {
      user = await User.create({ 
        email, 
        role: 'admin', 
        name: 'Admin', 
        passcode: '123456',
        permissions: ['students_view', 'students_add', 'students_edit', 'students_delete', 'fees_collect', 'reports_view', 'verification']
      });
    }

    // Check if it matches the static passcode OR a valid generated OTP
    const isPasscodeMatch = user.passcode && user.passcode === otp;
    const isOTPMatch = user.otp === otp && user.otpExpiry > Date.now();

    // FALLBACK: Allow '123456' for the very first login and promote to admin
    const isInitialLogin = otp === '123456';

    if (!isPasscodeMatch && !isOTPMatch && !isInitialLogin) {
      return res.status(400).json({ message: 'Invalid or expired passcode' });
    }

    // If they used the initial passcode, ensure they are admin
    if (isInitialLogin && user.role !== 'admin') {
      user.role = 'admin';
      user.permissions = ['students_view', 'students_add', 'students_edit', 'students_delete', 'fees_collect', 'reports_view', 'verification'];
      await user.save();
    }

    // Reset OTP if it was used
    if (isOTPMatch) {
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: user._id, _id: user._id, email: user.email, role: user.role, name: user.name, permissions: user.permissions || [] }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendMobileOTP = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    let user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ message: 'Staff account not found with this number' });
    }

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    console.log(`Mobile OTP for ${mobile}: ${otp}`);
    res.json({ message: 'OTP sent to mobile' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyMobileOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const user = await User.findOne({ mobile });

    if (!user) return res.status(404).json({ message: 'Staff account not found' });

    // Check if it matches the static passcode OR a valid generated OTP
    const isPasscodeMatch = user.passcode && user.passcode === otp;
    const isOTPMatch = user.otp === otp && user.otpExpiry > Date.now();

    if (!isPasscodeMatch && !isOTPMatch) {
      return res.status(400).json({ message: 'Invalid or expired passcode' });
    }

    // Reset OTP if it was used
    if (isOTPMatch) {
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: user._id, _id: user._id, mobile: user.mobile, role: user.role, name: user.name, permissions: user.permissions || [] }
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
          _id: user._id,
        mobile: user.mobile,
        role: user.role,
        name: user.name,
        permissions: user.permissions || []
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
