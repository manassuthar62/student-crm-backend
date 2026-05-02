const mongoose = require('mongoose');
const User = require('./models/User');
const Center = require('./models/Center');
const University = require('./models/University');

async function checkDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm_app');
    console.log('Connected to DB');
    
    const userCount = await User.countDocuments();
    const centerCount = await Center.countDocuments();
    const univCount = await University.countDocuments();
    
    console.log(`Users: ${userCount}, Centers: ${centerCount}, Universities: ${univCount}`);
    
    const allUsers = await User.find({}, 'mobile name role');
    console.log('All Users:', allUsers);
    
    const allCenters = await Center.find({});
    console.log('All Centers:', allCenters);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
