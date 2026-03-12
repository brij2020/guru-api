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
    examSlug: 'sbi-clerk',
    stageSlug: 'prelims',
    section: 'english-language',
    domain: 'Government Exam - SBI Clerk',
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) output.email = args[i + 1];
    if (arg === '--exam-slug' && args[i + 1]) output.examSlug = args[i + 1];
    if (arg === '--stage-slug' && args[i + 1]) output.stageSlug = args[i + 1];
    if (arg === '--section' && args[i + 1]) output.section = args[i + 1];
    if (arg === '--domain' && args[i + 1]) output.domain = args[i + 1];
  }

  return output;
};

const normalize = (v) => String(v || '').trim().replace(/\s+/g, ' ');

const buildFingerprint = (questionText, type = 'mcq') =>
  crypto
    .createHash('sha1')
    .update(`${String(type).trim().toLowerCase()}::${normalize(questionText).toLowerCase()}`)
    .digest('hex');

const buildOptionObjects = (options) =>
  options.map((text, idx) => ({ id: String.fromCharCode(65 + idx), text }));

const seed = async () => {
  const cfg = parseArgs();
  await connectDB();

  const normalizedEmail = normalize(cfg.email).toLowerCase();
  let owner = await User.findOne({ email: normalizedEmail });
  if (!owner) {
    owner = await User.create({
      name: 'RC Seed Admin',
      email: normalizedEmail,
      password: 'Password1',
      role: 'admin',
    });
    console.log(`Created user: ${normalizedEmail}`);
  }

  const ownerId = owner._id;
  const groupId = `rc-${cfg.examSlug}-${cfg.stageSlug}-sample-001`;
  const groupTitle = 'RC Passage Sample 1';
  const passageText = normalize(
    'In recent years, digital payments in India have expanded rapidly due to UPI, better mobile access, and policy support. ' +
      'Small merchants increasingly prefer instant settlement and low transaction costs. ' +
      'However, cyber hygiene and fraud awareness remain essential for sustained trust.'
  );

  const questions = [
    {
      question: 'Which factor is explicitly mentioned as a driver of digital payment growth in the passage?',
      options: [
        'Rise of UPI infrastructure',
        'Decrease in internet literacy',
        'Ban on all cash payments',
        'Reduction in smartphone usage',
      ],
      answerKey: 'A',
      explanation: 'The passage directly mentions UPI as a key driver.',
      topic: 'Reading Comprehension',
      difficulty: 'easy',
    },
    {
      question: 'Why do small merchants prefer digital payments according to the passage?',
      options: [
        'Higher cash handling charges',
        'Instant settlement and lower costs',
        'Mandatory foreign exchange support',
        'Longer payment confirmation windows',
      ],
      answerKey: 'B',
      explanation: 'The passage states instant settlement and low transaction costs.',
      topic: 'Reading Comprehension',
      difficulty: 'easy',
    },
    {
      question: 'What is identified as necessary for sustained trust in digital payments?',
      options: [
        'Only hardware upgrades',
        'Weekly cashback campaigns',
        'Cyber hygiene and fraud awareness',
        'Complete removal of PIN authentication',
      ],
      answerKey: 'C',
      explanation: 'The passage ends by emphasizing cyber hygiene and fraud awareness.',
      topic: 'Reading Comprehension',
      difficulty: 'medium',
    },
    {
      question: 'The tone of the passage is best described as:',
      options: [
        'Purely critical of digital systems',
        'Balanced: optimistic with caution',
        'Indifferent to policy impact',
        'Focused only on global trends',
      ],
      answerKey: 'B',
      explanation: 'It highlights growth benefits but also cautions about fraud awareness.',
      topic: 'Reading Comprehension',
      difficulty: 'medium',
    },
    {
      question: 'Which of the following is NOT supported by the passage?',
      options: [
        'Policy support contributed to growth',
        'Fraud awareness is optional for trust',
        'Mobile access improved adoption',
        'Merchants value low transaction costs',
      ],
      answerKey: 'B',
      explanation: 'The passage says fraud awareness is essential, not optional.',
      topic: 'Reading Comprehension',
      difficulty: 'hard',
    },
  ];

  const docs = questions.map((item, idx) => {
    const options = item.options.map((opt) => normalize(opt));
    const optionObjects = buildOptionObjects(options);
    const answer = optionObjects.find((opt) => opt.id === item.answerKey)?.text || '';
    return {
      owner: ownerId,
      sourceAttempt: null,
      provider: 'seed-script',
      testId: `seed-${cfg.examSlug}-${cfg.stageSlug}-rc`,
      testTitle: `${cfg.examSlug.toUpperCase()} ${cfg.stageSlug.toUpperCase()} RC Seed`,
      domain: normalize(cfg.domain),
      examSlug: normalize(cfg.examSlug).toLowerCase(),
      stageSlug: normalize(cfg.stageSlug).toLowerCase(),
      section: normalize(cfg.section).toLowerCase(),
      groupType: 'rc_passage',
      groupId,
      groupTitle,
      passageText,
      groupOrder: idx + 1,
      questionNumber: idx + 1,
      source: {
        exam: 'Memory-Based',
        year: 2025,
        shift: 1,
        type: 'seed-rc',
      },
      difficulty: item.difficulty,
      type: 'mcq',
      topic: item.topic,
      tags: ['reading-comprehension', 'rc-passage', cfg.examSlug, cfg.stageSlug],
      promptContext: 'RC sample seeded for end-to-end grouping validation.',
      question: normalize(item.question),
      options,
      optionObjects,
      answer: normalize(answer),
      answerKey: item.answerKey,
      explanation: normalize(item.explanation),
      reviewStatus: 'draft',
      fingerprint: buildFingerprint(item.question, 'mcq'),
      timesSeen: 1,
      lastUsedAt: new Date(),
    };
  });

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

  const seededRows = await QuestionBank.find({
    owner: ownerId,
    groupType: 'rc_passage',
    groupId,
  })
    .sort({ groupOrder: 1 })
    .select('_id groupId groupOrder question answerKey reviewStatus')
    .lean();

  console.log('RC sample seed complete');
  console.log(`Owner: ${normalizedEmail} (${String(ownerId)})`);
  console.log(`Upserted: ${upserts}, Modified: ${modified}, Total in group: ${seededRows.length}`);
  console.log(`Group: ${groupId}`);
  console.log('Rows:');
  for (const row of seededRows) {
    console.log(`- ${String(row._id)} | order=${row.groupOrder} | key=${row.answerKey} | ${row.question}`);
  }
  process.exit(0);
};

seed().catch((error) => {
  console.error('RC sample seed failed:', error?.message || error);
  process.exit(1);
});
