const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  features: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    enabled: { type: Boolean, default: true },
  }],
  pricing: {
    monthly: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      enabled: { type: Boolean, default: true },
    },
    yearly: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      enabled: { type: Boolean, default: true },
      discountPercent: { type: Number, default: 0 },
    },
  },
  limits: {
    mockTestsPerWeek: { type: Number, default: 0 },
    mockTestsPerMonth: { type: Number, default: 0 },
    mockTestsUnlimited: { type: Boolean, default: false },
    dailyPracticeAllowed: { type: Boolean, default: true },
    expressShareTokens: { type: Number, default: 0 },
    analyticsAccess: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    downloadPDF: { type: Boolean, default: false },
    aiCurationAllowed: { type: Boolean, default: false },
  },
  billing: {
    trialDays: { type: Number, default: 0 },
    allowPause: { type: Boolean, default: false },
    maxPauseDays: { type: Number, default: 0 },
    cancelAnytime: { type: Boolean, default: true },
  },
  examAccess: [{
    examSlug: { type: String, required: true },
    examName: { type: String, required: true },
    allowed: { type: Boolean, default: true },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

subscriptionPlanSchema.index({ slug: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });
subscriptionPlanSchema.index({ 'pricing.monthly.amount': 1 });

subscriptionPlanSchema.methods.getPrice = function(cycle = 'monthly') {
  const pricing = this.pricing[cycle] || this.pricing.monthly;
  if (!pricing.enabled) return null;
  return {
    amount: pricing.amount,
    currency: pricing.currency,
  };
};

subscriptionPlanSchema.methods.getFeatureValue = function(featureKey) {
  const feature = this.features.find(f => f.key === featureKey);
  return feature ? feature.value : null;
};

subscriptionPlanSchema.methods.hasFeature = function(featureKey) {
  const feature = this.features.find(f => f.key === featureKey);
  return feature ? feature.enabled : false;
};

subscriptionPlanSchema.methods.toPublic = function() {
  return {
    _id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    features: this.features.filter(f => f.enabled).map(f => ({
      key: f.key,
      label: f.label,
      value: f.value,
    })),
    pricing: {
      monthly: this.pricing.monthly.enabled ? {
        amount: this.pricing.monthly.amount,
        currency: this.pricing.monthly.currency,
      } : null,
      yearly: this.pricing.yearly.enabled ? {
        amount: this.pricing.yearly.amount,
        currency: this.pricing.yearly.currency,
        discountPercent: this.pricing.yearly.discountPercent,
        savings: this.pricing.monthly.enabled
          ? Math.round(this.pricing.monthly.amount * 12 - this.pricing.yearly.amount)
          : 0,
      } : null,
    },
    limits: this.limits,
    billing: this.billing,
    isActive: this.isActive,
    isFeatured: this.isFeatured,
    sortOrder: this.sortOrder,
  };
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;
