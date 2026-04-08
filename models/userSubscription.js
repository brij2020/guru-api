const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'expired', 'trial', 'pending'],
    default: 'active',
  },
  cycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
  },
  pricing: {
    amountPaid: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
  },
  billing: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    nextBillingDate: { type: Date },
    trialEndDate: { type: Date },
    lastBillingDate: { type: Date },
  },
  usage: {
    mockTestsThisWeek: { type: Number, default: 0 },
    mockTestsThisMonth: { type: Number, default: 0 },
    expressShareTokensUsed: { type: Number, default: 0 },
    lastResetAt: { type: Date, default: Date.now },
  },
  payment: {
    transactionId: { type: String },
    orderId: { type: String },
    paymentGateway: { type: String, enum: ['paytm', 'razorpay', 'stripe', 'free', 'admin'], default: 'free' },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'] },
    paymentDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  pause: {
    isPaused: { type: Boolean, default: false },
    pausedAt: { type: Date },
    resumeDate: { type: Date },
    pauseReason: { type: String },
  },
  cancellation: {
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
    willExpireAt: { type: Date },
    canReactivate: { type: Boolean, default: true },
  },
  metadata: {
    source: { type: String, enum: ['website', 'admin', 'gift', 'referral'], default: 'website' },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  renewsAutomatically: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ planId: 1 });
userSubscriptionSchema.index({ 'billing.endDate': 1 });
userSubscriptionSchema.index({ status: 1, 'billing.endDate': 1 });
userSubscriptionSchema.index({ 'billing.nextBillingDate': 1 });

userSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && new Date() < this.billing.endDate;
};

userSubscriptionSchema.methods.getRemainingDays = function() {
  const now = new Date();
  const end = new Date(this.billing.endDate);
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

userSubscriptionSchema.methods.canTakeMockTest = function() {
  if (!this.isActive()) return false;
  const plan = this.planId;
  
  if (this.usage.mockTestsThisWeek >= plan.limits.mockTestsPerWeek && !plan.limits.mockTestsUnlimited) {
    return { allowed: false, reason: 'weekly_limit', remaining: 0 };
  }
  if (this.usage.mockTestsThisMonth >= plan.limits.mockTestsPerMonth && !plan.limits.mockTestsUnlimited) {
    return { allowed: false, reason: 'monthly_limit', remaining: 0 };
  }
  
  const weeklyRemaining = plan.limits.mockTestsUnlimited ? Infinity : plan.limits.mockTestsPerWeek - this.usage.mockTestsThisWeek;
  const monthlyRemaining = plan.limits.mockTestsUnlimited ? Infinity : plan.limits.mockTestsPerMonth - this.usage.mockTestsThisMonth;
  
  return {
    allowed: true,
    remaining: Math.min(weeklyRemaining, monthlyRemaining),
    weeklyRemaining,
    monthlyRemaining,
  };
};

userSubscriptionSchema.methods.hasFeature = function(featureKey) {
  const plan = this.planId;
  if (!plan) return false;
  
  if (featureKey === 'dailyPractice') return plan.limits.dailyPracticeAllowed;
  if (featureKey === 'analytics') return plan.limits.analyticsAccess;
  if (featureKey === 'prioritySupport') return plan.limits.prioritySupport;
  if (featureKey === 'downloadPDF') return plan.limits.downloadPDF;
  if (featureKey === 'aiCuration') return plan.limits.aiCurationAllowed;
  
  const feature = plan.features?.find(f => f.key === featureKey);
  return feature ? feature.enabled : false;
};

userSubscriptionSchema.methods.getTokenBalance = function() {
  const total = this.planId?.limits?.expressShareTokens || 0;
  return Math.max(0, total - this.usage.expressShareTokensUsed);
};

userSubscriptionSchema.methods.useToken = function(count = 1) {
  const balance = this.getTokenBalance();
  if (balance < count) return false;
  this.usage.expressShareTokensUsed += count;
  return true;
};

userSubscriptionSchema.methods.resetWeeklyUsage = function() {
  this.usage.mockTestsThisWeek = 0;
  this.usage.lastResetAt = new Date();
};

userSubscriptionSchema.methods.pauseSubscription = function(reason, resumeDate = null) {
  this.pause = {
    isPaused: true,
    pausedAt: new Date(),
    resumeDate: resumeDate,
    pauseReason: reason,
  };
  this.status = 'paused';
};

userSubscriptionSchema.methods.resumeSubscription = function() {
  this.pause = {
    isPaused: false,
    pausedAt: null,
    resumeDate: null,
    pauseReason: null,
  };
  this.status = 'active';
};

userSubscriptionSchema.methods.cancelSubscription = function(reason = '') {
  this.cancellation = {
    isCancelled: true,
    cancelledAt: new Date(),
    cancelReason: reason,
    willExpireAt: this.billing.endDate,
    canReactivate: true,
  };
  this.status = 'cancelled';
  this.renewsAutomatically = false;
};

userSubscriptionSchema.methods.toPublic = function() {
  const plan = this.planId;
  return {
    _id: this._id,
    status: this.status,
    cycle: this.cycle,
    plan: plan?.toPublic ? plan.toPublic() : null,
    billing: {
      startDate: this.billing.startDate,
      endDate: this.billing.endDate,
      nextBillingDate: this.billing.nextBillingDate,
      remainingDays: this.getRemainingDays(),
      isActive: this.isActive(),
    },
    usage: {
      mockTestsThisWeek: this.usage.mockTestsThisWeek,
      mockTestsThisMonth: this.usage.mockTestsThisMonth,
      mockTestLimit: plan?.limits?.mockTestsUnlimited ? -1 : (plan?.limits?.mockTestsPerWeek || 0),
      expressShareTokens: this.getTokenBalance(),
    },
    canTakeMockTest: this.canTakeMockTest(),
    features: {
      dailyPractice: this.hasFeature('dailyPractice'),
      analytics: this.hasFeature('analytics'),
      prioritySupport: this.hasFeature('prioritySupport'),
      downloadPDF: this.hasFeature('downloadPDF'),
      aiCuration: this.hasFeature('aiCuration'),
    },
  };
};

userSubscriptionSchema.methods.incrementMockTestUsage = function() {
  this.usage.mockTestsThisWeek += 1;
  this.usage.mockTestsThisMonth += 1;
};

const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);

module.exports = UserSubscription;
