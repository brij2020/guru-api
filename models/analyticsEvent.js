const mongoose = require('mongoose');

const AnalyticsEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        'wishlist_add',
        'wishlist_remove',
        'share',
        'download',
        'search',
        'category_view',
        'exam_view',
        'exam_start',
        'exam_complete',
        'bookmark',
        'comment',
        'rating',
      ],
      index: true,
    },
    visitorId: {
      type: String,
      required: true,
      index: true,
      maxlength: 120,
    },
    sessionId: {
      type: String,
      index: true,
      maxlength: 120,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    path: {
      type: String,
      trim: true,
      maxlength: 300,
      index: true,
    },
    examSlug: {
      type: String,
      trim: true,
      maxlength: 120,
      index: true,
    },
    categorySlug: {
      type: String,
      trim: true,
      maxlength: 120,
      index: true,
    },
    categoryName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    referrer: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    country: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    language: {
      type: String,
      trim: true,
      maxlength: 10,
      default: 'en',
    },
  },
  { timestamps: true }
);

AnalyticsEventSchema.index({ eventType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ examSlug: 1, eventType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ categorySlug: 1, eventType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ visitorId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ userId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
