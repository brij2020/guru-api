const mongoose = require('mongoose');

const QuestionSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: 'mcq' },
    difficulty: { type: String, trim: true, default: 'medium' },
    question: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    topic: { type: String, trim: true, default: '' },
    groupType: { type: String, trim: true, default: 'none' },
    groupId: { type: String, trim: true, default: '' },
    groupTitle: { type: String, trim: true, default: '' },
    passageText: { type: String, trim: true, default: '' },
    groupOrder: { type: Number, default: null },
    hasVisual: { type: Boolean, default: false },
    assets: { type: [mongoose.Schema.Types.Mixed], default: [] },
    options: { type: [String], default: [] },
    answer: { type: String, trim: true, default: '' },
    explanation: { type: String, trim: true, default: '' },
    inputOutput: { type: String, trim: true, default: '' },
    solutionApproach: { type: String, trim: true, default: '' },
    sampleSolution: { type: String, trim: true, default: '' },
    complexity: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, default: '' },
    expectedOutput: { type: String, trim: true, default: '' },
    idealSolution: { type: String, trim: true, default: '' },
    keyConsiderations: { type: [String], default: [] },
  },
  { _id: false }
);

const SectionPlanItemSchema = new mongoose.Schema(
  {
    section: { type: String, trim: true, default: '' },
    targetCount: { type: Number, min: 0, default: 0 },
    servedCount: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const AttemptQuestionRefSchema = new mongoose.Schema(
  {
    sourceQuestionId: { type: String, trim: true },
    id: { type: String, trim: true },
    type: { type: String, trim: true },
    difficulty: { type: String, trim: true },
    question: { type: String, trim: true, maxlength: 6000 },
    section: { type: String, trim: true, maxlength: 120 },
    topic: { type: String, trim: true, maxlength: 160 },
    groupType: { type: String, trim: true, maxlength: 32 },
    groupId: { type: String, trim: true, maxlength: 120 },
    groupTitle: { type: String, trim: true, maxlength: 300 },
    passageText: { type: String, trim: true, maxlength: 12000 },
    groupOrder: { type: Number, min: 1, max: 200, default: null },
    hasVisual: { type: Boolean },
    assets: { type: [mongoose.Schema.Types.Mixed], default: [] },
    options: { type: [String], default: [] },
    answer: { type: String, trim: true, maxlength: 2000 },
    explanation: { type: String, trim: true, maxlength: 12000 },
    inputOutput: { type: String, trim: true, maxlength: 12000 },
    solutionApproach: { type: String, trim: true, maxlength: 12000 },
    sampleSolution: { type: String, trim: true, maxlength: 12000 },
    complexity: { type: String, trim: true, maxlength: 12000 },
    code: { type: String, trim: true, maxlength: 12000 },
    expectedOutput: { type: String, trim: true, maxlength: 12000 },
    idealSolution: { type: String, trim: true, maxlength: 12000 },
    keyConsiderations: { type: [String], default: [] },
  },
  { _id: false }
);

AttemptQuestionRefSchema.pre("save", function() {
  if (this.groupOrder !== undefined && this.groupOrder !== null && this.groupOrder < 1) {
    this.groupOrder = null;
  }
});

const CompletionSummarySchema = new mongoose.Schema(
  {
    autoSubmitted: { type: Boolean, default: false },
    score: { type: Number, min: 0, default: 0 },
    percentage: { type: Number, min: 0, default: 0 },
    correctCount: { type: Number, min: 0, default: 0 },
    incorrectCount: { type: Number, min: 0, default: 0 },
    unattemptedCount: { type: Number, min: 0, default: 0 },
    attemptedCount: { type: Number, min: 0, default: 0 },
    timeSpent: { type: Number, min: 0, default: 0 },
    sectionScores: { type: [mongoose.Schema.Types.Mixed], default: [] },
    difficultyBreakdown: { type: [mongoose.Schema.Types.Mixed], default: [] },
    typeBreakdown: { type: [mongoose.Schema.Types.Mixed], default: [] },
    userAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
    questionTimeSpent: { type: mongoose.Schema.Types.Mixed, default: {} },
    questionStatus: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiEvaluation: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const TestAttemptSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    testId: {
      type: String,
      trim: true,
      default: '',
    },
    testTitle: {
      type: String,
      trim: true,
      required: [true, 'Test title is required'],
      maxlength: 200,
    },
    domain: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    difficulty: {
      type: String,
      trim: true,
      default: 'all',
      maxlength: 60,
    },
    topics: {
      type: [String],
      default: [],
    },
    questionStyles: {
      type: [String],
      default: [],
    },
    questionCount: {
      type: String,
      trim: true,
      default: 'all',
      maxlength: 20,
    },
    totalQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },
    duration: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['started', 'completed'],
      default: 'started',
    },
    paperQuestions: {
      type: [QuestionSnapshotSchema],
      default: [],
    },
    questionRefs: {
      type: [AttemptQuestionRefSchema],
      default: [],
    },
    sectionPlan: {
      type: [SectionPlanItemSchema],
      default: [],
    },
    completion: {
      type: CompletionSummarySchema,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestAttempt', TestAttemptSchema);
