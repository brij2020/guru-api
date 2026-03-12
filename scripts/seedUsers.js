#!/usr/bin/env node
/* eslint-disable no-console */
const connectDB = require('../config/db');
const User = require('../models/user');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const upsertUser = async ({ name, email, password, role }) => {
  const safeEmail = normalizeEmail(email);
  if (!safeEmail) {
    throw new Error(`Invalid email for role ${role}`);
  }
  if (!password || String(password).length < 8) {
    throw new Error(`Password for ${safeEmail} must be at least 8 characters`);
  }

  let user = await User.findOne({ email: safeEmail }).select('+password');
  if (!user) {
    user = new User({
      name,
      email: safeEmail,
      password,
      role,
    });
  } else {
    user.name = name || user.name;
    user.role = role || user.role;
    user.password = password;
  }

  await user.save();
  return user;
};

const run = async () => {
  await connectDB();

  const adminName = process.env.SEED_ADMIN_NAME || 'Guru Admin';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@guru.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

  const studentName = process.env.SEED_STUDENT_NAME || 'Test Student';
  const studentEmail = process.env.SEED_STUDENT_EMAIL || 'student@guru.local';
  const studentPassword = process.env.SEED_STUDENT_PASSWORD || 'Student@12345';

  const admin = await upsertUser({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
  });

  const student = await upsertUser({
    name: studentName,
    email: studentEmail,
    password: studentPassword,
    role: 'user',
  });

  console.log('Users seeded successfully');
  console.log(`Admin:   ${admin.email} (role=${admin.role})`);
  console.log(`Student: ${student.email} (role=${student.role})`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Seed users failed:', error?.message || error);
  process.exit(1);
});

