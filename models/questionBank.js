const mongoose = require('mongoose');

const QuestionBankSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceAttempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestAttempt',
      default: null,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32,
    },
    testId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
      index: true,
    },
    testTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },
    domain: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
      index: true,
    },
    difficulty: {
      type: String,
      trim: true,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
      index: true,
    },
    type: {
      type: String,
      trim: true,
      enum: ['coding', 'mcq', 'theory', 'output', 'scenario'],
      default: 'mcq',
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    promptContext: {
      type: String,
      trim: true,
      default: '',
      maxlength: 4000,
    },
    question: {
      type: String,
      trim: true,
      required: true,
      maxlength: 6000,
    },
    options: {
      type: [String],
      default: [],
    },
    answer: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
      maxlength: 6000,
    },
    inputOutput: {
      type: String,
      trim: true,
      default: '',
      maxlength: 8000,
    },
    solutionApproach: {
      type: String,
      trim: true,
      default: '',
      maxlength: 8000,
    },
    sampleSolution: {
      type: String,
      trim: true,
      default: '',
      maxlength: 12000,
    },
    complexity: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    keyConsiderations: {
      type: [String],
      default: [],
    },
    fingerprint: {
      type: String,
      required: true,
      maxlength: 80,
      index: true,
    },
    timesSeen: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

QuestionBankSchema.index({ owner: 1, fingerprint: 1 }, { unique: true });
QuestionBankSchema.index({ owner: 1, domain: 1, type: 1, difficulty: 1, topic: 1 });

module.exports = mongoose.model('QuestionBank', QuestionBankSchema);
