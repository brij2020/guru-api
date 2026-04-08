const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/guruapi_local')
  .then(async () => {
    const bcrypt = require('bcryptjs');
    const password = 'Student123';
    const hash = await bcrypt.hash(password, 12);
    console.log('Fresh hash:', hash);
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const user = await User.findOne({ email: 'student@example.com' });
    user.password = hash;
    await user.save();
    
    console.log('Password updated');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(e => { console.error(e); process.exit(1); });
