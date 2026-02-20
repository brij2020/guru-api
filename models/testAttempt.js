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
      enum: ['started'],
      default: 'started',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestAttempt', TestAttemptSchema);
