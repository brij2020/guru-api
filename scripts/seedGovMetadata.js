#!/usr/bin/env node
/* eslint-disable no-console */
const connectDB = require('../config/db');
const User = require('../models/user');
const Category = require('../models/category');
const Topic = require('../models/topic');
const QuestionStyle = require('../models/questionStyle');
const DifficultyLevel = require('../models/difficultyLevel');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const GOV_CATEGORIES = [
  { name: 'Government Exams', description: 'Common metadata umbrella for government exam practice' },
  { name: 'Banking Exams', description: 'SBI, IBPS, RBI and similar recruitment exams' },
  { name: 'SSC Exams', description: 'SSC CGL, CHSL, MTS and related exams' },
  { name: 'Railway Exams', description: 'RRB NTPC, Group D and related railway exams' },
  { name: 'UPSC & Civil Services', description: 'UPSC CSE and related civil service exams' },
  { name: 'State PSC Exams', description: 'State public service commission exams' },
  { name: 'Defence Exams', description: 'CDS, AFCAT, NDA and defence entry exams' },
  { name: 'Teaching Exams', description: 'CTET, TET and teaching eligibility exams' },
  { name: 'Insurance Exams', description: 'LIC, NIACL and insurance recruitment exams' },
];

const GOV_TOPICS = [
  'General Awareness',
  'Current Affairs',
  'Quantitative Aptitude',
  'Reasoning Ability',
  'English Language',
  'Computer Awareness',
  'Data Interpretation',
  'Puzzle & Seating Arrangement',
];

const GOV_QUESTION_STYLES = [
  'Single Correct MCQ',
  'Statement Based MCQ',
  'Assertion-Reason',
  'Match the Following',
  'Fill in the Blanks',
  'Data Interpretation MCQ',
  'Puzzle Based MCQ',
  'Reading Comprehension MCQ',
  'Chronology/Sequence MCQ',
  'True/False with Explanation',
];

const GOV_DIFFICULTIES = ['easy', 'medium', 'hard'];

const ensureAdmin = async () => {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL || 'admin@example.com');
  let admin = await User.findOne({ email });

  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123';
    admin = await User.create({
      name: process.env.SEED_ADMIN_NAME || 'Guru Admin',
      email,
      password,
      role: 'admin',
    });
    console.log(`Created admin user: ${email}`);
  }

  return admin;
};

const run = async () => {
  await connectDB();
  const admin = await ensureAdmin();

  const categoryByName = new Map();
  let categoryCreated = 0;
  for (const item of GOV_CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { owner: admin._id, name: item.name },
      { $set: { description: item.description } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (doc) categoryByName.set(item.name, doc);
    if (doc?.createdAt?.getTime() === doc?.updatedAt?.getTime()) categoryCreated += 1;
  }

  const govCategory = categoryByName.get('Government Exams');
  if (!govCategory) {
    throw new Error('Government Exams category not found after upsert');
  }

  let topicsCreated = 0;
  for (const topicName of GOV_TOPICS) {
    const doc = await Topic.findOneAndUpdate(
      { owner: admin._id, category: govCategory._id, name: topicName },
      { $set: { description: '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (doc?.createdAt?.getTime() === doc?.updatedAt?.getTime()) topicsCreated += 1;
  }

  let stylesCreated = 0;
  for (const style of GOV_QUESTION_STYLES) {
    const doc = await QuestionStyle.findOneAndUpdate(
      { owner: admin._id, category: govCategory._id, style },
      { $set: {} },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (doc?.createdAt?.getTime() === doc?.updatedAt?.getTime()) stylesCreated += 1;
  }

  let levelsCreated = 0;
  for (const level of GOV_DIFFICULTIES) {
    const doc = await DifficultyLevel.findOneAndUpdate(
      { owner: admin._id, level },
      { $set: {} },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (doc?.createdAt?.getTime() === doc?.updatedAt?.getTime()) levelsCreated += 1;
  }

  const [categoryCount, topicCount, styleCount, difficultyCount] = await Promise.all([
    Category.countDocuments({ owner: admin._id }),
    Topic.countDocuments({ owner: admin._id }),
    QuestionStyle.countDocuments({ owner: admin._id }),
    DifficultyLevel.countDocuments({ owner: admin._id }),
  ]);

  console.log('Gov metadata seed complete');
  console.log(`Owner: ${admin.email}`);
  console.log(`Categories: ${categoryCount} (new: ${categoryCreated})`);
  console.log(`Topics: ${topicCount} (new: ${topicsCreated})`);
  console.log(`Question styles: ${styleCount} (new: ${stylesCreated})`);
  console.log(`Difficulty levels: ${difficultyCount} (new: ${levelsCreated})`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Gov metadata seed failed:', error?.message || error);
  process.exit(1);
});

