const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['topic', 'revision', 'practice', 'improvement'],
    required: true,
  },
  itemId: {
    type: String,
    default: null,
  },
  title: {
    type: String,
    required: true,
  },
  titleHi: {
    type: String,
    default: '',
  },
  reason: {
    type: String,
    required: true,
  },
  reasonHi: {
    type: String,
    default: '',
  },
  priority: {
    type: Number,
    default: 5,
  },
  topic: {
    type: String,
    default: '',
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'all'],
    default: 'all',
  },
  questionCount: {
    type: Number,
    default: 10,
  },
  dueAt: {
    type: Date,
    default: null,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  dismissed: {
    type: Boolean,
    default: false,
  },
  dismissedAt: {
    type: Date,
    default: null,
  },
});

const userRecommendationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recommendations: [recommendationSchema],
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
}, {
  timestamps: true,
});

userRecommendationSchema.index({ userId: 1 }, { unique: true });
userRecommendationSchema.index({ 'recommendations.priority': -1 });
userRecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

userRecommendationSchema.methods.getActiveRecommendations = function() {
  return this.recommendations.filter(r => !r.completed && !r.dismissed);
};

userRecommendationSchema.methods.getCompletedCount = function() {
  return this.recommendations.filter(r => r.completed).length;
};

module.exports = mongoose.model('UserRecommendation', userRecommendationSchema);
