const mongoose = require('mongoose');

const SectionPlanSchema = new mongoose.Schema(
  {
    section: { type: String, trim: true, default: '' },
    targetCount: { type: Number, default: 0 },
    servedCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const MockPaperSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    goalSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    planId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    title: {
      type: String,
      trim: true,
      default: '',
      maxlength: 220,
    },
    requestedQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },
    servedQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },
    sectionPlan: {
      type: [SectionPlanSchema],
      default: [],
    },
    questionIds: {
      type: [String],
      default: [],
    },
    questions: {
      type: [Object],
      default: [],
    },
    sourceBreakdown: {
      dbCount: { type: Number, default: 0, min: 0 },
      aiTopupCount: { type: Number, default: 0, min: 0 },
    },
    diagnostics: {
      type: Object,
      default: {},
    },
    promptContext: {
      type: String,
      trim: true,
      default: '',
      maxlength: 4000,
    },
  },
  { timestamps: true }
);

MockPaperSchema.index({ owner: 1, examSlug: 1, stageSlug: 1, createdAt: -1 });

module.exports = mongoose.model('MockPaper', MockPaperSchema);
