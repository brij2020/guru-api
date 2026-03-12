const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const ApiError = require('../errors/apiError');
const { pdfJobAllowedBases } = require('../config/env');
const PdfExtractionJob = require('../models/pdfExtractionJob');
const questionBankService = require('./questionBankService');

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeSlug = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, '')
    .replace(/\s+/g, '-');

const ALLOWED_BASES = Array.isArray(pdfJobAllowedBases) && pdfJobAllowedBases.length > 0
  ? pdfJobAllowedBases
  : [process.cwd(), path.dirname(process.cwd()), '/tmp'];

const assertPathAllowed = (targetPath, label) => {
  const resolved = path.resolve(targetPath);
  const isAllowed = ALLOWED_BASES.some((base) => resolved.startsWith(path.resolve(base)));
  if (!isAllowed) {
    throw new ApiError(
      400,
      `${label} must be within allowed workspace or /tmp`,
      {
        receivedPath: resolved,
        allowedBases: ALLOWED_BASES.map((base) => path.resolve(base)),
      }
    );
  }
  return resolved;
};

const toJobSummary = (job) => ({
  id: String(job._id),
  status: job.status,
  examSlug: job.examSlug,
  stageSlug: job.stageSlug,
  paperFolder: job.paperFolder,
  outputFolder: job.outputFolder,
  chunkSize: Number(job.chunkSize || 0),
  outputFilesCount: Array.isArray(job.outputFiles) ? job.outputFiles.length : 0,
  imported: job.imported || {
    imported: 0,
    inserted: 0,
    updated: 0,
    duplicatesSkipped: 0,
    files: 0,
    importedAt: null,
  },
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  lastError: job.lastError || '',
});

const buildCreatePayload = (payload = {}) => {
  const examSlug = normalizeSlug(payload.examSlug);
  const stageSlug = normalizeSlug(payload.stageSlug);
  const paperFolderRaw = normalizeText(payload.paperFolder);
  if (/\.pdf$/i.test(paperFolderRaw)) {
    throw new ApiError(400, 'paperFolder must be a directory, not a .pdf file path', {
      receivedPath: path.resolve(paperFolderRaw),
      hint: 'Use the folder that contains PDFs, e.g. /Users/brijbhan/Downloads',
    });
  }
  const paperFolder = assertPathAllowed(paperFolderRaw, 'paperFolder');
  const outputFolder = assertPathAllowed(normalizeText(payload.outputFolder), 'outputFolder');

  return {
    examSlug,
    stageSlug,
    domain: normalizeText(payload.domain),
    provider: normalizeText(payload.provider || 'pyq-extractor'),
    testIdPrefix: normalizeText(payload.testIdPrefix || `${examSlug || 'exam'}-${stageSlug || 'stage'}-pyq`),
    testTitlePrefix: normalizeText(payload.testTitlePrefix || `${examSlug || 'Exam'} ${stageSlug || 'Stage'} PYQ`),
    promptContext: normalizeText(payload.promptContext || 'Extracted from exam papers'),
    paperFolder,
    outputFolder,
    chunkSize: Number(payload.chunkSize || 1000),
  };
};

const createJob = async ({ ownerId, payload }) => {
  const data = buildCreatePayload(payload);
  const job = await PdfExtractionJob.create({
    owner: ownerId,
    status: 'queued',
    ...data,
  });
  return toJobSummary(job);
};

const listJobs = async ({ ownerId, limit = 20 }) => {
  const rows = await PdfExtractionJob.find({ owner: ownerId })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(100, Number(limit || 20))))
    .lean();
  return rows.map(toJobSummary);
};

const getJob = async ({ ownerId, id }) => {
  const row = await PdfExtractionJob.findOne({ _id: id, owner: ownerId }).lean();
  if (!row) throw new ApiError(404, 'PDF extraction job not found');
  return {
    ...toJobSummary(row),
    report: row.report || null,
    outputFiles: Array.isArray(row.outputFiles) ? row.outputFiles : [],
    logs: row.logs || { stdout: '', stderr: '' },
  };
};

const runJob = async ({ ownerId, id }) => {
  const job = await PdfExtractionJob.findOne({ _id: id, owner: ownerId });
  if (!job) throw new ApiError(404, 'PDF extraction job not found');
  if (job.status === 'running') throw new ApiError(409, 'Job is already running');

  job.status = 'running';
  job.startedAt = new Date();
  job.finishedAt = null;
  job.lastError = '';
  job.logs = { stdout: '', stderr: '' };
  await job.save();

  const scriptPath = path.resolve(process.cwd(), 'pyscript/quiz.py');
  const args = [
    scriptPath,
    '--paper-folder',
    job.paperFolder,
    '--output-folder',
    job.outputFolder,
    '--exam-slug',
    job.examSlug || '',
    '--stage-slug',
    job.stageSlug || '',
    '--domain',
    job.domain || '',
    '--provider',
    job.provider || 'pyq-extractor',
    '--test-id-prefix',
    job.testIdPrefix || '',
    '--test-title-prefix',
    job.testTitlePrefix || '',
    '--prompt-context',
    job.promptContext || '',
    '--chunk-size',
    String(job.chunkSize || 1000),
  ];

  const result = await new Promise((resolve) => {
    const child = spawn('python3', args, { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });
    child.on('close', (code) => {
      resolve({ code: Number(code || 0), stdout, stderr });
    });
  });

  const reportPath = path.resolve(job.outputFolder, 'extraction-report.json');
  let report = null;
  let outputFiles = [];
  try {
    const reportRaw = await fs.readFile(reportPath, 'utf8');
    report = JSON.parse(reportRaw);
    outputFiles = Array.isArray(report?.outputFiles)
      ? report.outputFiles.map((item) => assertPathAllowed(String(item), 'output file'))
      : [];
  } catch {
    report = null;
    outputFiles = [];
  }

  job.logs = {
    stdout: String(result.stdout || '').slice(-50000),
    stderr: String(result.stderr || '').slice(-50000),
  };
  job.report = report;
  job.outputFiles = outputFiles;
  job.finishedAt = new Date();

  if (result.code !== 0) {
    job.status = 'failed';
    job.lastError = normalizeText(result.stderr || `Python process exited with code ${result.code}`);
  } else {
    job.status = 'completed';
    job.lastError = '';
  }

  await job.save();
  return getJob({ ownerId, id });
};

const importJobOutputs = async ({ ownerId, id }) => {
  const job = await PdfExtractionJob.findOne({ _id: id, owner: ownerId });
  if (!job) throw new ApiError(404, 'PDF extraction job not found');
  if (!Array.isArray(job.outputFiles) || job.outputFiles.length === 0) {
    throw new ApiError(400, 'No output files found. Run extraction first.');
  }

  let imported = 0;
  let inserted = 0;
  let updated = 0;
  let duplicatesSkipped = 0;
  let files = 0;

  for (const filePath of job.outputFiles) {
    const safePath = assertPathAllowed(filePath, 'output file');
    if (!safePath.endsWith('.json')) continue;
    const raw = await fs.readFile(safePath, 'utf8');
    const payload = JSON.parse(raw);
    const result = await questionBankService.importQuestionsFromJson({
      ownerId,
      payload,
    });
    imported += Number(result?.imported || 0);
    inserted += Number(result?.inserted || 0);
    updated += Number(result?.updated || 0);
    duplicatesSkipped += Number(result?.duplicatesSkipped || 0);
    files += 1;
  }

  job.imported = {
    imported,
    inserted,
    updated,
    duplicatesSkipped,
    files,
    importedAt: new Date(),
  };
  await job.save();

  return {
    ...toJobSummary(job),
    importSummary: job.imported,
  };
};

module.exports = {
  createJob,
  listJobs,
  getJob,
  runJob,
  importJobOutputs,
};
