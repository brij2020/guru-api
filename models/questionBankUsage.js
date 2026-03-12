const mongoose = require('mongoose');

const QuestionBankUsageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    questionBankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBank',
      required: true,
      index: true,
    },
    examSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    stageSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    groupId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
      index: true,
    },
    timesServed: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastServedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

QuestionBankUsageSchema.index({ owner: 1, questionBankId: 1 }, { unique: true });
QuestionBankUsageSchema.index({ owner: 1, lastServedAt: -1 });
QuestionBankUsageSchema.index({ owner: 1, examSlug: 1, stageSlug: 1, groupId: 1, lastServedAt: -1 });

module.exports = mongoose.model('QuestionBankUsage', QuestionBankUsageSchema);
