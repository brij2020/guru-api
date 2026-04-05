const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  referralCode: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'registered', 'subscribed'],
    default: 'pending',
  },
  rewards: {
    referrerSignupCoins: { type: Number, default: 0 },
    referrerSignupDays: { type: Number, default: 0 },
    referredSignupCoins: { type: Number, default: 0 },
    referredSignupDays: { type: Number, default: 0 },
    referrerSubscriptionCoins: { type: Number, default: 0 },
    referrerSubscriptionDays: { type: Number, default: 0 },
  },
  referredUserEmail: {
    type: String,
    default: null,
  },
  registeredAt: {
    type: Date,
    default: null,
  },
  subscribedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

referralSchema.index({ referrer: 1, referred: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
