const mongoose = require('mongoose');

const JOB_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled'];

const AiGenerationJobSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      enum: ['gemini', 'chatgpt', 'openai'],
      default: 'gemini',
      index: true,
    },
    status: {
      type: String,
      trim: true,
      enum: JOB_STATUSES,
      default: 'queued',
      index: true,
    },
    payload: {
      testId: { type: String, trim: true, default: '' },
      testTitle: { type: String, trim: true, default: '' },
      domain: { type: String, trim: true, default: '' },
      attemptMode: { type: String, trim: true, enum: ['practice', 'exam'], default: 'exam' },
      difficulty: { type: String, trim: true, default: 'medium' },
      topics: { type: [String], default: [] },
      questionStyles: { type: [String], default: [] },
      examSlug: { type: String, trim: true, default: '' },
      stageSlug: { type: String, trim: true, default: '' },
      promptContext: { type: String, trim: true, default: '' },
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
      max: 20000,
    },
    batchSize: {
      type: Number,
      default: 50,
      min: 5,
      max: 100,
    },
    maxRetries: {
      type: Number,
      default: 2,
      min: 0,
      max: 10,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    generatedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    insertedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    processedBatches: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedBatches: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastError: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    workerId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    nextRunAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

AiGenerationJobSchema.index({ owner: 1, status: 1, createdAt: -1 });
AiGenerationJobSchema.index({ status: 1, nextRunAt: 1, createdAt: 1 });

module.exports = mongoose.model('AiGenerationJob', AiGenerationJobSchema);
