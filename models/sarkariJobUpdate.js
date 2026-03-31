const mongoose = require('mongoose');

const sarkariJobUpdateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: ['vacancy', 'result', 'admit_card'],
      required: true,
    },
    categoryLabel: {
      type: String,
      enum: ['New Vacancy', 'Result', 'Admit Card'],
    },
    categoryLabel_hi: {
      type: String,
      enum: ['नई भर्ती', 'परिणाम', 'प्रवेश पत्र'],
    },
    organization: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Important Dates
    onlineStartDate: { type: Date },
    onlineEndDate: { type: Date },
    feeLastDate: { type: Date },
    correctionLastDate: { type: Date },
    examDate: { type: Date },
    admitCardDate: { type: Date },
    resultDate: { type: Date },

    // Application Fee
    generalFee: { type: String, maxlength: 100 },
    obcFee: { type: String, maxlength: 100 },
    scStFee: { type: String, maxlength: 100 },
    phFee: { type: String, maxlength: 100 },
    paymentMode: { type: String, maxlength: 200 },

    // Age Limit
    ageAsOnDate: { type: String, maxlength: 100 },
    ageRelaxation: { type: String, maxlength: 200 },

    // Vacancy Details
    totalPosts: { type: String, maxlength: 50 },
    postName: { type: String, maxlength: 200 },
    customPosts: { type: String, maxlength: 10000 },

    // Exam Mode
    examMode: {
      type: String,
      enum: ['online', 'offline', 'hybrid', 'physical'],
    },

    // Important Links
    applyLink: { type: String, trim: true, maxlength: 1000 },

    // Detailed Sections
    eligibilityCriteria: { type: String, maxlength: 5000 },
    eligibilityCriteria_hi: { type: String, maxlength: 5000 },
    howToFill: { type: String, maxlength: 5000 },
    howToFill_hi: { type: String, maxlength: 5000 },
    selectionProcess: { type: String, maxlength: 3000 },
    selectionProcess_hi: { type: String, maxlength: 3000 },

    // General Description
    description: { type: String, maxlength: 5000 },
    description_hi: { type: String, maxlength: 5000 },

    // Custom Fields (JSON strings for dynamic data)
    customDates: { type: String, maxlength: 10000 },
    customFees: { type: String, maxlength: 5000 },
    customAgeLimits: { type: String, maxlength: 5000 },
  },
  {
    timestamps: true,
  }
);

sarkariJobUpdateSchema.index({ category: 1, isActive: 1 });
sarkariJobUpdateSchema.index({ isFeatured: 1, createdAt: -1 });

sarkariJobUpdateSchema.pre('save', function (next) {
  const categoryMap = {
    vacancy: { label: 'New Vacancy', label_hi: 'नई भर्ती' },
    result: { label: 'Result', label_hi: 'परिणाम' },
    admit_card: { label: 'Admit Card', label_hi: 'प्रवेश पत्र' },
  };
  if (this.category && categoryMap[this.category]) {
    this.categoryLabel = categoryMap[this.category].label;
    this.categoryLabel_hi = categoryMap[this.category].label_hi;
  }
  next();
});

module.exports = mongoose.model('SarkariJobUpdate', sarkariJobUpdateSchema);
