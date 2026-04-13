const mongoose = require('mongoose');

const userTopicPerformanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  totalAttempts: {
    type: Number,
    default: 0,
  },
  correctAnswers: {
    type: Number,
    default: 0,
  },
  accuracy: {
    type: Number,
    default: 0,
  },
  avgTimeSeconds: {
    type: Number,
    default: 0,
  },
  totalTimeSeconds: {
    type: Number,
    default: 0,
  },
  trend: {
    type: String,
    enum: ['improving', 'stable', 'declining'],
    default: 'stable',
  },
  trendDelta: {
    type: Number,
    default: 0,
  },
  lastAttemptedAt: {
    type: Date,
    default: null,
  },
  wrongQuestionIds: [{
    type: String,
  }],
  nextReviewAt: {
    type: Date,
    default: null,
  },
  easeFactor: {
    type: Number,
    default: 2.5,
  },
  interval: {
    type: Number,
    default: 1,
  },
  repetitions: {
    type: Number,
    default: 0,
  },
  weeklyAccuracy: [{
    week: String,
    accuracy: Number,
    attempts: Number,
  }],
}, {
  timestamps: true,
});

userTopicPerformanceSchema.index({ userId: 1, topic: 1 }, { unique: true });
userTopicPerformanceSchema.index({ userId: 1, accuracy: 1 });
userTopicPerformanceSchema.index({ nextReviewAt: 1 });

userTopicPerformanceSchema.methods.calculateAccuracy = function() {
  if (this.totalAttempts === 0) return 0;
  return Math.round((this.correctAnswers / this.totalAttempts) * 100);
};

userTopicPerformanceSchema.methods.calculateTrend = function() {
  if (!this.weeklyAccuracy || this.weeklyAccuracy.length < 2) {
    return { trend: 'stable', trendDelta: 0 };
  }
  
  const sorted = [...this.weeklyAccuracy].sort((a, b) => a.week.localeCompare(b.week));
  const recent = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  
  if (!recent || !previous || previous.accuracy === 0) {
    return { trend: 'stable', trendDelta: 0 };
  }
  
  const delta = Math.round(((recent.accuracy - previous.accuracy) / previous.accuracy) * 100);
  
  let trend = 'stable';
  if (delta < -10) trend = 'declining';
  else if (delta > 10) trend = 'improving';
  
  return { trend, trendDelta: delta };
};

module.exports = mongoose.model('UserTopicPerformance', userTopicPerformanceSchema);
