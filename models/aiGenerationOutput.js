const mongoose = require('mongoose');

const AiGenerationOutputSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiGenerationJob',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      trim: true,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    requestedCount: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    generatedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    insertedOrUpdatedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    provider: {
      type: String,
      trim: true,
      default: 'gemini',
      maxlength: 32,
    },
    error: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

AiGenerationOutputSchema.index({ jobId: 1, batchNumber: 1 }, { unique: true });

module.exports = mongoose.model('AiGenerationOutput', AiGenerationOutputSchema);
