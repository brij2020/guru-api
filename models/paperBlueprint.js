const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    label: {
      type: String,
      trim: true,
      required: true,
      maxlength: 180,
    },
    count: {
      type: Number,
      required: true,
      min: 1,
      max: 2000,
    },
    topics: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const PaperBlueprintSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    examSlug: {
      type: String,
      trim: true,
      required: true,
      maxlength: 80,
      index: true,
    },
    stageSlug: {
      type: String,
      trim: true,
      required: true,
      maxlength: 80,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    learningMode: {
      type: String,
      trim: true,
      enum: ['foundation', 'intermediate', 'advanced', 'expert'],
      default: 'foundation',
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 60,
    },
    examStageQuestions: {
      type: Number,
      required: true,
      min: 1,
      default() {
        return Number(this.totalQuestions || 1);
      },
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    sections: {
      type: [SectionSchema],
      default: [],
      validate: {
        validator: (sections) => Array.isArray(sections) && sections.length > 0,
        message: 'At least one section is required',
      },
    },
    difficultyMix: {
      easy: { type: Number, default: 0.3, min: 0, max: 1 },
      medium: { type: Number, default: 0.5, min: 0, max: 1 },
      hard: { type: Number, default: 0.2, min: 0, max: 1 },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

PaperBlueprintSchema.index({ examSlug: 1, stageSlug: 1, isActive: 1, updatedAt: -1 });
PaperBlueprintSchema.index({ owner: 1, examSlug: 1, stageSlug: 1 });

module.exports = mongoose.model('PaperBlueprint', PaperBlueprintSchema);
