const mongoose = require('mongoose');

const PageViewSchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    title: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    scrollPercent: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserJourneySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    visitorId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pathSequence: [PageViewSchema],
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    entryPage: {
      type: String,
      default: '',
    },
    exitPage: {
      type: String,
      default: '',
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    referrer: {
      type: String,
      default: '',
    },
    events: [
      {
        type: { type: String },
        target: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

UserJourneySchema.index({ startedAt: -1 });
UserJourneySchema.index({ 'pathSequence.path': 1 });
UserJourneySchema.index({ entryPage: 1, exitPage: 1 });

UserJourneySchema.methods.addPageView = function (path, title, duration = 0, scrollPercent = 0, clickCount = 0) {
  this.pathSequence.push({
    path,
    title,
    duration,
    scrollPercent,
    clickCount,
    timestamp: new Date(),
  });
  this.pageCount = this.pathSequence.length;
  this.exitPage = path;
  this.totalDuration = this.pathSequence.reduce((sum, p) => sum + (p.duration || 0), 0);
};

UserJourneySchema.methods.addEvent = function (type, target) {
  this.events.push({
    type,
    target,
    timestamp: new Date(),
  });
};

UserJourneySchema.methods.endJourney = function () {
  this.endedAt = new Date();
  if (this.pathSequence.length > 0) {
    this.entryPage = this.pathSequence[0].path;
    this.exitPage = this.pathSequence[this.pathSequence.length - 1].path;
  }
};

module.exports = mongoose.model('UserJourney', UserJourneySchema);
