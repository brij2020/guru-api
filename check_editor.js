const mongoose = require('mongoose');
require('./config/db');
const User = require('./models/user');

(async () => {
  const user = await User.findOne({ email: 'xeditor1@yopmail.com' }).lean();
  if (user) {
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Actual Role:', user.actualRole);
    console.log('Admin Permissions:', JSON.stringify(user.adminPermissions, null, 2));
  } else {
    console.log('User not found');
  }
  await mongoose.disconnect();
})();
