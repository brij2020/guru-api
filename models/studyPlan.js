const mongoose = require('mongoose');

const studyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  subjectId: {
    type: String,
    default: null,
  },
  topic: {
    type: String,
    default: '',
  },
  date: {
    type: Date,
    required: true,
  },
  startHour: {
    type: String,
    required: true,
  },
  endHour: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: '📚',
  },
  color: {
    type: String,
    default: 'from-blue-500 to-blue-400',
  },
  isBreak: {
    type: Boolean,
    default: false,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  progress: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
