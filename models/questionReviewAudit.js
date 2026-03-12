const mongoose = require('mongoose');

const QuestionReviewAuditSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBank',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      trim: true,
      enum: ['status_change'],
      default: 'status_change',
      index: true,
    },
    fromStatus: {
      type: String,
      trim: true,
      enum: ['draft', 'reviewed', 'approved', 'rejected'],
      required: true,
    },
    toStatus: {
      type: String,
      trim: true,
      enum: ['draft', 'reviewed', 'approved', 'rejected'],
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
  },
  { timestamps: true }
);

QuestionReviewAuditSchema.index({ questionId: 1, createdAt: -1 });
QuestionReviewAuditSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('QuestionReviewAudit', QuestionReviewAuditSchema);
