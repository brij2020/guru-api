const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/guruapi_local')
  .then(async () => {
    const password = 'Student123';
    const hash = await bcrypt.hash(password, 12);
    console.log('New hash:', hash);
    console.log('Hash length:', hash.length);
    
    // Use direct MongoDB update to bypass mongoose hooks
    const db = mongoose.connection.db;
    const updateObj = { '$set': { password: hash } };
    const result = await db.collection('users').updateOne(
      { email: 'student@example.com' },
      updateObj
    );
    console.log('Modified count:', result.modifiedCount);
    
    // Verify
    const user = await db.collection('users').findOne({ email: 'student@example.com' });
    console.log('Password after update:', user.password);
    console.log('Password length:', user.password.length);
    
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(e => { console.error(e); process.exit(1); });
