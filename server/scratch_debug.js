const mongoose = require('mongoose');
const Student = require('./models/Student');
const User = require('./models/User');

async function checkStudents() {
  try {
    await mongoose.connect('mongodb://localhost:27017/student-crm');
    console.log('Connected to MongoDB');

    const students = await Student.find({}).populate('addedBy', 'name role');
    console.log('Total Students in DB:', students.length);
    
    students.forEach((s, i) => {
      console.log(`${i+1}. Student: ${s.name}, AddedBy: ${s.addedBy ? s.addedBy.name : 'NULL'}, AddedByID: ${s.addedBy ? s.addedBy._id : 'N/A'}`);
    });

    const users = await User.find({});
    console.log('\nUsers List:');
    users.forEach(u => {
      console.log(`User: ${u.name}, Role: ${u.role}, ID: ${u._id}`);
    });

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStudents();
