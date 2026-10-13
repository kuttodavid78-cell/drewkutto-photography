require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

// Usage:
//   npm run seed:admin                          -> uses ADMIN_USERNAME / ADMIN_PASSWORD from .env
//   npm run seed:admin -- myname mypassword     -> uses the values you type (nothing stored in .env)
//
// Creates the admin account, or RESETS its password if the username already exists.
(async () => {
  const username = (process.argv[2] || process.env.ADMIN_USERNAME || '').trim();
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD in .env, or run:');
    console.error('  npm run seed:admin -- <username> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('The password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Admin.findOne({ username });
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Admin "${username}" already existed — its password has been reset.`);
  } else {
    await Admin.create({ username, passwordHash });
    console.log(`Admin account "${username}" created.`);
  }
  console.log('You can now sign in at /admin with that username and password.');

  await mongoose.disconnect();
})().catch(err => {
  console.error('Admin setup failed:', err.message);
  process.exit(1);
});
