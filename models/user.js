const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { bcryptSaltRounds } = require('../config/env');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'editor', 'reviewer'],
      default: 'user',
    },
    actualRole: {
      type: String,
      enum: ['user', 'editor', 'reviewer', 'admin', 'super_admin'],
      default: 'user',
    },
    adminPermissions: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    referralCode: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: String,
      default: null,
    },
    referralStats: {
      totalShares: { type: Number, default: 0 },
      coinsFromShares: { type: Number, default: 0 },
      totalReferrals: { type: Number, default: 0 },
      registeredReferrals: { type: Number, default: 0 },
      subscribedReferrals: { type: Number, default: 0 },
      coinsFromReferrals: { type: Number, default: 0 },
    },
    preferences: {
      lockDay: {
        type: String,
        enum: ['friday', 'saturday'],
        default: 'friday'
      },
      examSlug: {
        type: String,
        default: 'ssc-cgl'
      },
      stageSlug: {
        type: String,
        default: 'tier-1'
      }
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, bcryptSaltRounds);
  this.passwordChangedAt = new Date();
  next();
});

UserSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

UserSchema.methods.hasPermission = function hasPermission(section, requiredLevel = 'read') {
  const levelMap = { none: 0, read: 1, write: 2, manage: 3 };
  const required = levelMap[requiredLevel] || 0;
  
  if (this.role === 'super_admin') return true;
  
  const permissions = this.adminPermissions instanceof Map 
    ? this.adminPermissions 
    : new Map(Object.entries(this.adminPermissions || {}));
  
  const userLevel = levelMap[permissions.get(section)] || 0;
  return userLevel >= required;
};

module.exports = mongoose.model('User', UserSchema);
