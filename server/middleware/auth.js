const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const findUserFromRequest = async () => {
      const userId = req.header('x-user-id') || req.query.userId;
      if (!userId) return null;
      return User.findById(userId);
    };
    
    // 1. Check for Token (Modern Mobile App & Updated Admin Panel)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const userId = decoded.userId || decoded.id || decoded._id || decoded.sub;
        const user = await User.findById(userId);
        if (user) {
          req.user = user;
          req.token = token;
          return next();
        }
      } catch (tokenErr) {
        console.error('Auth token verification failed:', tokenErr.message);
      }
    }

    // 2. Check for Legacy Query Params (Backward Compatibility for non-updated Web Pages)
    const user = await findUserFromRequest();
    if (user) {
      req.user = user;
      return next();
    }

    res.status(401).json({ message: 'Authentication required. Please login again.' });
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin only' });
  }
};

module.exports = { auth, adminOnly };
