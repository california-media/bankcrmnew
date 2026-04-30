require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = (process.env.ADMIN_EMAIL || 'admin@bankcrm.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Admin already exists: ${email}`);
    } else {
      await User.create({
        name: 'Admin',
        email,
        password,
        role: 'admin',
        isActive: true,
      });
      console.log(`Admin created: ${email} / ${password}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
