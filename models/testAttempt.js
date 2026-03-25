const mongoose = require('mongoose');

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
    startedAt: {
      type: Date,
      default: Date.now,
    },
    // Result fields (filled on completion)
    completedAt: {
      type: Date,
    },
    autoSubmitted: {
      type: Boolean,
      default: false,
    },
    // Score metrics
    score: {
      type: Number,
      min: 0,
      default: 0,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    correctCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    incorrectCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    unattemptedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    attemptedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Time metrics
    timeSpent: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Section-wise breakdown
    sectionScores: [{
      section: {
        type: String,
        trim: true,
      },
      correct: {
        type: Number,
        min: 0,
        default: 0,
      },
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    }],
    // Difficulty-wise breakdown
    difficultyBreakdown: [{
      difficulty: {
        type: String,
        trim: true,
      },
      correct: {
        type: Number,
        min: 0,
        default: 0,
      },
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    }],
    // Question type breakdown
    typeBreakdown: [{
      type: {
        type: String,
        trim: true,
      },
      correct: {
        type: Number,
        min: 0,
        default: 0,
      },
      total: {
        type: Number,
        min: 0,
        default: 0,
      },
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    }],
  },
  { timestamps: true }
);

// Indexes for dashboard queries
TestAttemptSchema.index({ owner: 1, completedAt: -1 });
TestAttemptSchema.index({ owner: 1, domain: 1, completedAt: -1 });

module.exports = mongoose.model('TestAttempt', TestAttemptSchema);
