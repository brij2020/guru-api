const mongoose = require('mongoose');

const negativeMarkingSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true,
  },
  perWrongAnswer: {
    type: Number,
    default: 0.25,
    min: 0,
    max: 1,
  },
}, { _id: false });

const stageSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  durationMinutes: {
    type: Number,
    default: 60,
    min: 0,
  },
  questionCount: {
    type: Number,
    default: 100,
    min: 0,
  },
  totalMarks: {
    type: Number,
    default: 100,
    min: 0,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  negativeMarking: {
    type: negativeMarkingSchema,
    default: () => ({ enabled: true, perWrongAnswer: 0.25 }),
  },
}, { _id: false });

const examSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  icon: {
    type: String,
    default: '',
    trim: true,
  },
  stages: {
    type: [stageSchema],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  negativeMarking: {
    type: negativeMarkingSchema,
    default: () => ({ enabled: true, perWrongAnswer: 0.25 }),
  },
}, {
  timestamps: true,
});

examSchema.index({ slug: 1 });
examSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('Exam', examSchema);
