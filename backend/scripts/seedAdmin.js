require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD in .env before seeding.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await connectDB();

  const existing = await Admin.findOne({ username });
  if (existing) {
    console.log(`Admin "${username}" already exists. Not overwriting.`);
    console.log('To reset the password, delete this document from the "admins" collection and re-run this script.');
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await Admin.create({ username, passwordHash });
    console.log(`Admin account "${username}" created.`);
  }

  await mongoose.disconnect();
})();
