#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    outputDir: path.join(process.cwd(), 'backups', `db-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`),
    clean: true,
    keepCollections: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out' && args[i + 1]) opts.outputDir = path.resolve(args[i + 1]);
    if (arg === '--backup-only') opts.clean = false;
    if (arg === '--keep' && args[i + 1]) {
      opts.keepCollections = args[i + 1]
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return opts;
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const run = async () => {
  const opts = parseArgs();
  await connectDB();

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  fs.mkdirSync(opts.outputDir, { recursive: true });
  console.log(`Backing up database: ${dbName}`);
  console.log(`Backup directory: ${opts.outputDir}`);

  const manifest = {
    database: dbName,
    createdAt: new Date().toISOString(),
    collections: [],
    cleanPerformed: false,
    deletedCounts: {},
  };

  for (const name of collectionNames) {
    const rows = await db.collection(name).find({}).toArray();
    const file = path.join(opts.outputDir, `${name}.json`);
    writeJson(file, rows);
    manifest.collections.push({ name, count: rows.length, file: path.basename(file) });
    console.log(`Backed up ${name}: ${rows.length}`);
  }

  if (opts.clean) {
    console.log('Cleaning collections...');
    for (const name of collectionNames) {
      if (opts.keepCollections.includes(name)) {
        console.log(`Skipped ${name} (kept)`);
        continue;
      }
      const result = await db.collection(name).deleteMany({});
      manifest.deletedCounts[name] = Number(result.deletedCount || 0);
      console.log(`Cleared ${name}: ${manifest.deletedCounts[name]}`);
    }
    manifest.cleanPerformed = true;
  }

  writeJson(path.join(opts.outputDir, 'manifest.json'), manifest);
  console.log('Done.');
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Backup/Clean failed:', error?.message || error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

