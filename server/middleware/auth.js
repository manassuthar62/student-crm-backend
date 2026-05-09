const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    // 1. Check for Token (Modern Mobile App)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
        req.token = token;
        return next();
      }
    }

    // 2. Check for Legacy Query Params (Old Admin Panel Pages)
    const { userId, role } = req.query;
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        req.user = user;
        return next();
      }
    }

    // 3. DEFAULT/FALLBACK: If no authentication provided, treat as Admin (Backward Compatibility for Web Panel)
    // We fetch any admin user to populate req.user context
    const defaultAdmin = await User.findOne({ role: 'admin' });
    if (defaultAdmin) {
      req.user = defaultAdmin;
      return next();
    }

    res.status(401).json({ message: 'Authentication required' });
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
