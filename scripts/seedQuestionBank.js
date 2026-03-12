#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/user');
const QuestionBank = require('../models/questionBank');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    perExam: 120,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) output.email = args[i + 1];
    if (arg === '--per-exam' && args[i + 1]) output.perExam = Number(args[i + 1]);
  }

  if (!Number.isFinite(output.perExam) || output.perExam <= 0) {
    output.perExam = 120;
  }

  return output;
};

const buildFingerprint = (questionText, type = 'mcq') =>
  crypto
    .createHash('sha1')
    .update(`${String(type).trim().toLowerCase()}::${String(questionText).trim().toLowerCase()}`)
    .digest('hex');

const examConfigs = [
  {
    examSlug: 'sbi-clerk',
    stageSlug: 'prelims',
    domain: 'Government Exam - SBI Clerk',
    sections: [
      { key: 'english-language', label: 'English Language' },
      { key: 'numerical-ability', label: 'Numerical Ability' },
      { key: 'reasoning-ability', label: 'Reasoning Ability' },
    ],
    topics: ['concept builder', 'time management', 'speed test', 'previous year style'],
  },
  {
    examSlug: 'ssc-cgl',
    stageSlug: 'tier-1',
    domain: 'Government Exam - SSC CGL',
    sections: [
      { key: 'general-awareness', label: 'General Awareness' },
      { key: 'quantitative-aptitude', label: 'Quantitative Aptitude' },
      { key: 'english-comprehension', label: 'English Comprehension' },
      { key: 'general-intelligence-reasoning', label: 'General Intelligence & Reasoning' },
    ],
    topics: ['weak topic practice', 'time management', 'mock simulation', 'revision drill'],
  },
];

const difficulties = ['easy', 'medium', 'hard'];

const buildQuestionDoc = ({ ownerId, exam, index }) => {
  const section = exam.sections[index % exam.sections.length];
  const topic = exam.topics[index % exam.topics.length];
  const difficulty = difficulties[index % difficulties.length];
  const qNo = index + 1;
  const stem = `${exam.examSlug.toUpperCase()} ${exam.stageSlug.toUpperCase()} ${section.label}: Practice question ${qNo} on ${topic}.`;

  const options = [
    `Option A for ${section.label} Q${qNo}`,
    `Option B for ${section.label} Q${qNo}`,
    `Option C for ${section.label} Q${qNo}`,
    `Option D for ${section.label} Q${qNo}`,
  ];

  const answer = options[qNo % 4];
  const question = `${stem} Select the most appropriate answer.`;

  return {
    owner: ownerId,
    sourceAttempt: null,
    provider: 'seed-script',
    testId: `seed-${exam.examSlug}-${exam.stageSlug}`,
    testTitle: `${exam.examSlug.toUpperCase()} ${exam.stageSlug.toUpperCase()} Seed Paper`,
    domain: exam.domain,
    examSlug: exam.examSlug,
    stageSlug: exam.stageSlug,
    section: section.key,
    difficulty,
    type: 'mcq',
    topic,
    tags: [topic, section.key, 'Single Correct MCQ', 'Statement Based MCQ'],
    promptContext: 'Seeded from local script for DB-first testing.',
    question,
    options,
    answer,
    explanation: `Seed explanation for ${section.label} question ${qNo}.`,
    fingerprint: buildFingerprint(question, 'mcq'),
    timesSeen: 1,
    lastUsedAt: new Date(),
  };
};

const seed = async () => {
  const { email, perExam } = parseArgs();
  await connectDB();

  const normalizedEmail = String(email).trim().toLowerCase();
  let owner = await User.findOne({ email: normalizedEmail });
  if (!owner) {
    owner = await User.create({
      name: 'Seed User',
      email: normalizedEmail,
      password: 'Password1',
      role: 'admin',
    });
    console.log(`Created user: ${normalizedEmail}`);
  }

  const ownerId = owner._id;
  const docs = examConfigs.flatMap((exam) =>
    Array.from({ length: perExam }).map((_, index) => buildQuestionDoc({ ownerId, exam, index }))
  );

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { owner: doc.owner, fingerprint: doc.fingerprint },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await QuestionBank.bulkWrite(ops, { ordered: false });
  const upserts = Object.keys(result?.upsertedIds || {}).length;
  const modified = Number(result?.modifiedCount || 0);
  const total = upserts + modified;

  const sbiCount = await QuestionBank.countDocuments({ owner: ownerId, examSlug: 'sbi-clerk', stageSlug: 'prelims' });
  const sscCount = await QuestionBank.countDocuments({ owner: ownerId, examSlug: 'ssc-cgl', stageSlug: 'tier-1' });

  console.log('Seed complete');
  console.log(`Owner: ${normalizedEmail} (${String(ownerId)})`);
  console.log(`Updated records: ${total} (inserted: ${upserts}, modified: ${modified})`);
  console.log(`SBI Clerk Prelims count: ${sbiCount}`);
  console.log(`SSC CGL Tier 1 count: ${sscCount}`);
  process.exit(0);
};

seed().catch((error) => {
  console.error('Seed failed:', error?.message || error);
  process.exit(1);
});
