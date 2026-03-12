const mongoose = require('mongoose');

const PDF_JOB_STATUSES = ['queued', 'running', 'completed', 'failed'];

const PdfExtractionJobSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      trim: true,
      enum: PDF_JOB_STATUSES,
      default: 'queued',
      index: true,
    },
    examSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
      index: true,
    },
    stageSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
      index: true,
    },
    domain: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    provider: {
      type: String,
      trim: true,
      default: 'pyq-extractor',
      maxlength: 60,
    },
    testIdPrefix: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },
    testTitlePrefix: {
      type: String,
      trim: true,
      default: '',
      maxlength: 220,
    },
    promptContext: {
      type: String,
      trim: true,
      default: 'Extracted from exam papers',
      maxlength: 4000,
    },
    paperFolder: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    outputFolder: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    chunkSize: {
      type: Number,
      default: 1000,
      min: 100,
      max: 5000,
    },
    report: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    outputFiles: {
      type: [String],
      default: [],
    },
    imported: {
      imported: { type: Number, default: 0, min: 0 },
      inserted: { type: Number, default: 0, min: 0 },
      updated: { type: Number, default: 0, min: 0 },
      duplicatesSkipped: { type: Number, default: 0, min: 0 },
      files: { type: Number, default: 0, min: 0 },
      importedAt: { type: Date, default: null },
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      trim: true,
      default: '',
      maxlength: 4000,
    },
    logs: {
      stdout: { type: String, trim: true, default: '', maxlength: 50000 },
      stderr: { type: String, trim: true, default: '', maxlength: 50000 },
    },
  },
  { timestamps: true }
);

PdfExtractionJobSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('PdfExtractionJob', PdfExtractionJobSchema);
