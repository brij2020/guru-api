const mongoose = require('mongoose');

const UserAnalyticsSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    visitorId: {
      type: String,
      trim: true,
      required: true,
      index: true,
      maxlength: 120,
    },
    sessionId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
      maxlength: 120,
    },
    path: {
      type: String,
      trim: true,
      required: true,
      index: true,
      maxlength: 300,
    },
    pageTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    pageType: {
      type: String,
      trim: true,
      default: 'page',
      maxlength: 80,
    },
    lang: {
      type: String,
      trim: true,
      default: 'en',
      maxlength: 10,
    },
    examSlug: {
      type: String,
      trim: true,
      default: '',
      index: true,
      maxlength: 120,
    },
    categoryKey: {
      type: String,
      trim: true,
      default: '',
      index: true,
      maxlength: 120,
    },
    testId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    referrer: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    deviceType: {
      type: String,
      trim: true,
      default: 'desktop',
      maxlength: 30,
    },
    activeTimeMs: {
      type: Number,
      min: 0,
      default: 0,
    },
    clickCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    interactionCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxScrollPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

UserAnalyticsSessionSchema.index({ owner: 1, startedAt: -1 });
UserAnalyticsSessionSchema.index({ path: 1, lastSeenAt: -1 });
UserAnalyticsSessionSchema.index({ examSlug: 1, startedAt: -1 });
UserAnalyticsSessionSchema.index({ categoryKey: 1, startedAt: -1 });

module.exports = mongoose.model('UserAnalyticsSession', UserAnalyticsSessionSchema);
