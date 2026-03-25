const mongoose = require('mongoose');

const QuestionBankSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceAttempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestAttempt',
      default: null,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32,
    },
    testId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
      index: true,
    },
    testTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },
    domain: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
      index: true,
    },
    language: {
      type: String,
      trim: true,
      default: 'en',
      maxlength: 16,
      index: true,
    },
    examSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
      index: true,
    },
    stageSlug: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
      index: true,
    },
    section: {
      type: String,
      trim: true,
      default: 'unmapped',
      maxlength: 120,
      index: true,
    },
    groupType: {
      type: String,
      trim: true,
      enum: ['none', 'rc_passage', 'table', 'image_grid', 'diagram'],
      default: 'none',
      index: true,
    },
    groupId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
      index: true,
    },
    groupTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    passageText: {
      type: String,
      trim: true,
      default: '',
      maxlength: 12000,
    },
    groupOrder: {
      type: Number,
      default: null,
      min: 1,
      max: 200,
    },
    questionNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    source: {
      exam: {
        type: String,
        trim: true,
        default: '',
        maxlength: 120,
      },
      year: {
        type: Number,
        default: null,
        min: 1900,
        max: 2100,
      },
      shift: {
        type: Number,
        default: null,
        min: 1,
        max: 20,
      },
      type: {
        type: String,
        trim: true,
        default: '',
        maxlength: 60,
      },
    },
    difficulty: {
      type: String,
      trim: true,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
      index: true,
    },
    type: {
      type: String,
      trim: true,
      enum: ['coding', 'mcq', 'theory', 'output', 'scenario'],
      default: 'mcq',
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    promptContext: {
      type: String,
      trim: true,
      default: '',
      maxlength: 4000,
    },
    question: {
      type: String,
      trim: true,
      required: true,
      maxlength: 6000,
    },
    options: {
      type: [String],
      default: [],
    },
    optionObjects: {
      type: [
        {
          _id: false,
          id: {
            type: String,
            trim: true,
            default: '',
            maxlength: 8,
          },
          text: {
            type: String,
            trim: true,
            default: '',
            maxlength: 1000,
          },
        },
      ],
      default: [],
    },
    answer: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    answerKey: {
      type: String,
      trim: true,
      default: '',
      maxlength: 8,
    },
    parsedAnswerKey: {
      type: String,
      trim: true,
      default: '',
      maxlength: 8,
    },
    answerConfidence: {
      type: String,
      trim: true,
      enum: ['high', 'medium', 'low', 'unknown'],
      default: 'unknown',
      index: true,
    },
    answerRawSnippet: {
      type: String,
      trim: true,
      default: '',
      maxlength: 4000,
    },
    hasVisual: {
      type: Boolean,
      default: false,
      index: true,
    },
    assets: {
      type: [
        {
          _id: false,
          kind: {
            type: String,
            trim: true,
            enum: ['image', 'chart_image', 'diagram_image', 'table_image', 'chart_data'],
            default: 'image',
          },
          url: {
            type: String,
            trim: true,
            default: '',
            maxlength: 1200,
          },
          alt: {
            type: String,
            trim: true,
            default: '',
            maxlength: 500,
          },
          width: {
            type: Number,
            default: null,
            min: 1,
          },
          height: {
            type: Number,
            default: null,
            min: 1,
          },
          caption: {
            type: String,
            trim: true,
            default: '',
            maxlength: 800,
          },
          sourcePage: {
            type: Number,
            default: null,
            min: 1,
          },
          data: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
          },
        },
      ],
      default: [],
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
      maxlength: 6000,
    },
    inputOutput: {
      type: String,
      trim: true,
      default: '',
      maxlength: 8000,
    },
    solutionApproach: {
      type: String,
      trim: true,
      default: '',
      maxlength: 8000,
    },
    sampleSolution: {
      type: String,
      trim: true,
      default: '',
      maxlength: 12000,
    },
    complexity: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    keyConsiderations: {
      type: [String],
      default: [],
    },
    reviewStatus: {
      type: String,
      trim: true,
      enum: ['draft', 'reviewed', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    fingerprint: {
      type: String,
      required: true,
      maxlength: 80,
      index: true,
    },
    timesSeen: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

QuestionBankSchema.index({ owner: 1, fingerprint: 1 }, { unique: true });
QuestionBankSchema.index({ owner: 1, domain: 1, type: 1, difficulty: 1, topic: 1 });
QuestionBankSchema.index({ owner: 1, examSlug: 1, stageSlug: 1, section: 1, difficulty: 1, type: 1 });
QuestionBankSchema.index({ owner: 1, examSlug: 1, stageSlug: 1, groupType: 1, groupId: 1, groupOrder: 1 });
QuestionBankSchema.index({ owner: 1, examSlug: 1, stageSlug: 1, reviewStatus: 1, updatedAt: -1 });

module.exports = mongoose.model('QuestionBank', QuestionBankSchema);
