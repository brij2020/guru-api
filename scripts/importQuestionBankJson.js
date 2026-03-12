#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const connectDB = require('../config/db');
const User = require('../models/user');
const QuestionBank = require('../models/questionBank');

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeSlug = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

const buildFingerprint = (question, type = 'mcq') =>
  crypto
    .createHash('sha1')
    .update(`${normalizeText(type).toLowerCase()}::${normalizeText(question).toLowerCase()}`)
    .digest('hex');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = {
    file: '',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    examSlug: '',
    stageSlug: '',
    domain: '',
    provider: 'openai-import',
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' && args[i + 1]) output.file = args[i + 1];
    if (arg === '--email' && args[i + 1]) output.email = args[i + 1];
    if (arg === '--exam' && args[i + 1]) output.examSlug = args[i + 1];
    if (arg === '--stage' && args[i + 1]) output.stageSlug = args[i + 1];
    if (arg === '--domain' && args[i + 1]) output.domain = args[i + 1];
    if (arg === '--provider' && args[i + 1]) output.provider = args[i + 1];
    if (arg === '--dry-run') output.dryRun = true;
  }

  if (!output.file) {
    throw new Error('Missing --file argument');
  }

  return output;
};

const parseInputFile = (filePath) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Input file not found: ${absolutePath}`);
  }
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  throw new Error('JSON must be an array or an object with `questions` array');
};

const toDoc = (item, defaults, ownerId) => {
  const question = normalizeText(item?.question || item?.questionText || item?.prompt);
  if (!question) return null;

  const options = Array.isArray(item?.options)
    ? item.options.map((x) => normalizeText(x)).filter(Boolean).slice(0, 4)
    : [];
  const answer = normalizeText(item?.answer || item?.correctAnswer || item?.correct_option);
  const section = normalizeSlug(item?.section || item?.sectionKey || '');
  const topic = normalizeText(item?.topic || item?.subtopic || '');
  const difficultyRaw = normalizeText(item?.difficulty).toLowerCase();
  const difficulty = ['easy', 'medium', 'hard'].includes(difficultyRaw) ? difficultyRaw : 'medium';

  const typeRaw = normalizeText(item?.type || item?.questionType || 'mcq').toLowerCase();
  const type =
    typeRaw.includes('output') ? 'output' :
      typeRaw.includes('theory') ? 'theory' :
        typeRaw.includes('coding') ? 'coding' :
          typeRaw.includes('scenario') ? 'scenario' : 'mcq';

  const examSlug = normalizeSlug(item?.examSlug || defaults.examSlug || '');
  const stageSlug = normalizeSlug(item?.stageSlug || defaults.stageSlug || '');
  const domain = normalizeText(item?.domain || defaults.domain || '');

  return {
    owner: ownerId,
    sourceAttempt: null,
    provider: normalizeText(defaults.provider),
    testId: normalizeText(item?.testId || `import-${examSlug}-${stageSlug}`),
    testTitle: normalizeText(item?.testTitle || `${examSlug} ${stageSlug} imported set`),
    domain,
    examSlug,
    stageSlug,
    section,
    difficulty,
    type,
    topic,
    tags: [topic, section, 'imported'].filter(Boolean),
    promptContext: normalizeText(item?.promptContext || 'Imported from OpenAI chat JSON'),
    question,
    options,
    answer,
    explanation: normalizeText(item?.explanation || ''),
    fingerprint: buildFingerprint(question, type),
    timesSeen: 1,
    lastUsedAt: new Date(),
  };
};

const run = async () => {
  const args = parseArgs();
  const rows = parseInputFile(args.file);
  await connectDB();

  const email = normalizeText(args.email).toLowerCase();
  let owner = await User.findOne({ email });
  if (!owner) {
    owner = await User.create({
      name: 'Import User',
      email,
      password: 'Password1',
      role: 'admin',
    });
    console.log(`Created user: ${email}`);
  }

  const docs = rows
    .map((item) => toDoc(item, args, owner._id))
    .filter(Boolean);

  if (docs.length === 0) {
    throw new Error('No valid questions found in input JSON');
  }

  console.log(`Parsed questions: ${docs.length}`);
  console.log(`Owner: ${email} (${String(owner._id)})`);
  console.log(`Exam/Stage defaults: ${args.examSlug || '-'} / ${args.stageSlug || '-'}`);

  if (args.dryRun) {
    console.log('Dry run complete. No DB writes performed.');
    process.exit(0);
  }

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { owner: doc.owner, fingerprint: doc.fingerprint },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await QuestionBank.bulkWrite(ops, { ordered: false });
  const inserted = Object.keys(result?.upsertedIds || {}).length;
  const modified = Number(result?.modifiedCount || 0);

  console.log(`Import complete. Inserted: ${inserted}, Updated: ${modified}`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Import failed:', error?.message || error);
  process.exit(1);
});
