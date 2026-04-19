const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  subjectId: { type: String, default: null },
}, { _id: false });

const weeklyTestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  examSlug: {
    type: String,
    default: 'ssc-cgl',
  },
  stageSlug: {
    type: String,
    default: 'tier-1',
  },
  lockDate: {
    type: Date,
    required: true,
    index: true,
  },
  weekStart: {
    type: Date,
    required: true,
  },
  weekEnd: {
    type: Date,
    required: true,
  },
  topics: [topicSchema],
  paperId: {
    type: String,
    default: null,
  },
  totalQuestions: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'generated', 'notified', 'completed'],
    default: 'pending',
  },
  notificationSent: {
    type: Boolean,
    default: false,
  },
  notificationSentAt: {
    type: Date,
    default: null,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

weeklyTestSchema.index({ userId: 1, lockDate: 1 }, { unique: true });
weeklyTestSchema.index({ status: 1, lockDate: -1 });
weeklyTestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WeeklyTest', weeklyTestSchema);
