const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
// const serviceAccount = require('./config/serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const universityRoutes = require('./routes/universityRoutes');
const centerRoutes = require('./routes/centerRoutes');
const studentRoutes = require('./routes/studentRoutes');
const feeRoutes = require('./routes/feeRoutes');
const staffRoutes = require('./routes/staffRoutes');
const settingRoutes = require('./routes/settingRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('Student Management System API is running...');
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_app';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    try {
      // Drop problematic indices to allow sparse recreation
      const collections = await mongoose.connection.db.listCollections({ name: 'users' }).toArray();
      if (collections.length > 0) {
        await mongoose.connection.db.collection('users').dropIndex('mobile_1').catch(() => {});
        await mongoose.connection.db.collection('users').dropIndex('email_1').catch(() => {});
        
        // Cleanup Universities index
        const universityCollections = await mongoose.connection.db.listCollections({ name: 'universities' }).toArray();
        if (universityCollections.length > 0) {
          await mongoose.connection.db.collection('universities').dropIndex('code_1').catch(() => {});
          console.log('🧹 University indices cleaned up');
        }
        
        console.log('🧹 Database indices cleaned up');
      }
    } catch (e) {
      console.log('Note: Index cleanup skipped or not needed');
    }
  })
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
