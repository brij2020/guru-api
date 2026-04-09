const User = require('../models/user');
const Referral = require('../models/referral');

const REFERRAL_CONFIG = {
  shareCoins: 5,
  signupReferrerCoins: 50,
  signupReferrerDays: 0,
  signupReferredCoins: 25,
  signupReferredDays: 3,
  subscribeReferrerCoins: 100,
  subscribeReferrerDays: 7,
};

const generateReferralCode = (userId) => {
  const shortId = userId.toString().slice(-6).toUpperCase();
  return `REF${shortId}`;
};

const createReferralCode = async (userId) => {
  const code = generateReferralCode(userId);
  const existing = await User.findOne({ referralCode: code });
  if (existing) {
    return generateReferralCode(userId) + Math.random().toString(36).substr(2, 3).toUpperCase();
  }
  return code;
};

const getReferralCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.referralCode) {
      user.referralCode = await createReferralCode(userId);
      await user.save();
    }

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralUrl: `${process.env.FRONTEND_URL || 'http://13.203.195.153:3000'}/signup?ref=${user.referralCode}`,
      },
    });
  } catch (error) {
    console.error('Error getting referral code:', error);
    res.status(500).json({ success: false, error: 'Failed to get referral code' });
  }
};

const getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const referrals = await Referral.find({ referrer: userId })
      .populate('referred', 'name email createdAt')
      .sort({ createdAt: -1 });

    const stats = {
      totalReferrals: referrals.length,
      registeredCount: referrals.filter(r => r.status !== 'pending').length,
      subscribedCount: referrals.filter(r => r.status === 'subscribed').length,
      pendingCount: referrals.filter(r => r.status === 'pending').length,
      totalCoinsEarned: referrals.reduce((sum, r) => sum + (r.rewards.referrerSignupCoins || 0) + (r.rewards.referrerSubscriptionCoins || 0), 0),
      totalDaysEarned: referrals.reduce((sum, r) => sum + (r.rewards.referrerSignupDays || 0) + (r.rewards.referrerSubscriptionDays || 0), 0),
    };

    res.json({
      success: true,
      data: {
        stats,
        referrals: referrals.map(r => ({
          _id: r._id,
          referredUser: r.referred ? {
            name: r.referred.name,
            email: r.referred.email,
            joinedAt: r.referred.createdAt,
          } : { email: r.referredUserEmail },
          status: r.status,
          rewards: r.rewards,
          createdAt: r.createdAt,
          registeredAt: r.registeredAt,
          subscribedAt: r.subscribedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
};

const recordShare = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.referralStats = user.referralStats || {};
    user.referralStats.totalShares = (user.referralStats.totalShares || 0) + 1;
    user.referralStats.coinsFromShares = (user.referralStats.coinsFromShares || 0) + REFERRAL_CONFIG.shareCoins;
    await user.save();

    res.json({
      success: true,
      data: {
        coinsEarned: REFERRAL_CONFIG.shareCoins,
        totalCoins: user.referralStats.coinsFromShares,
        totalShares: user.referralStats.totalShares,
      },
    });
  } catch (error) {
    console.error('Error recording share:', error);
    res.status(500).json({ success: false, error: 'Failed to record share' });
  }
};

const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params;
    const user = await User.findOne({ referralCode: code });
    
    if (!user) {
      return res.json({
        success: true,
        data: { valid: false, message: 'Invalid referral code' },
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        message: 'Valid referral code',
        referrerName: user.name || 'User',
      },
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({ success: false, error: 'Failed to validate referral code' });
  }
};

const processReferralOnSignup = async (referralCode, referredUserId, referredUserEmail) => {
  try {
    if (!referralCode) return null;

    const referrer = await User.findOne({ referralCode });
    if (!referrer) return null;

    const existingReferral = await Referral.findOne({
      referrer: referrer._id,
      referredUserEmail,
    });
    if (existingReferral) return existingReferral;

    const referral = new Referral({
      referrer: referrer._id,
      referred: referredUserId,
      referralCode,
      status: 'registered',
      referredUserEmail,
      registeredAt: new Date(),
      rewards: {
        referrerSignupCoins: REFERRAL_CONFIG.signupReferrerCoins,
        referrerSignupDays: REFERRAL_CONFIG.signupReferrerDays,
        referredSignupCoins: REFERRAL_CONFIG.signupReferredCoins,
        referredSignupDays: REFERRAL_CONFIG.signupReferredDays,
      },
    });
    await referral.save();

    referrer.referralStats = referrer.referralStats || {};
    referrer.referralStats.totalReferrals = (referrer.referralStats.totalReferrals || 0) + 1;
    referrer.referralStats.registeredReferrals = (referrer.referralStats.registeredReferrals || 0) + 1;
    referrer.referralStats.coinsFromReferrals = (referrer.referralStats.coinsFromReferrals || 0) + REFERRAL_CONFIG.signupReferrerCoins;
    await referrer.save();

    return referral;
  } catch (error) {
    console.error('Error processing referral on signup:', error);
    return null;
  }
};

const processReferralOnSubscription = async (referredUserId) => {
  try {
    const referral = await Referral.findOne({ referred: referredUserId, status: 'registered' });
    if (!referral) return null;

    referral.status = 'subscribed';
    referral.subscribedAt = new Date();
    referral.rewards.referrerSubscriptionCoins = REFERRAL_CONFIG.subscribeReferrerCoins;
    referral.rewards.referrerSubscriptionDays = REFERRAL_CONFIG.subscribeReferrerDays;
    await referral.save();

    const referrer = await User.findById(referral.referrer);
    if (referrer) {
      referrer.referralStats = referrer.referralStats || {};
      referrer.referralStats.subscribedReferrals = (referrer.referralStats.subscribedReferrals || 0) + 1;
      referrer.referralStats.coinsFromReferrals = (referrer.referralStats.coinsFromReferrals || 0) + REFERRAL_CONFIG.subscribeReferrerCoins;
      await referrer.save();
    }

    return referral;
  } catch (error) {
    console.error('Error processing referral on subscription:', error);
    return null;
  }
};

const getAdminReferralStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [totalReferrals, registeredReferrals, subscribedReferrals, recentReferrals] = await Promise.all([
      Referral.countDocuments(),
      Referral.countDocuments({ status: { $in: ['registered', 'subscribed'] } }),
      Referral.countDocuments({ status: 'subscribed' }),
      Referral.find(filter)
        .populate('referrer', 'name email referralCode')
        .populate('referred', 'name email')
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const conversionRate = totalReferrals > 0 ? ((subscribedReferrals / totalReferrals) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalReferrals,
          registeredReferrals,
          subscribedReferrals,
          conversionRate: parseFloat(conversionRate),
        },
        recentReferrals: recentReferrals.map(r => ({
          _id: r._id,
          referrer: r.referrer,
          referred: r.referred,
          status: r.status,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting admin referral stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
};

const updateReferralConfig = async (req, res) => {
  try {
    const updates = req.body;
    Object.assign(REFERRAL_CONFIG, updates);
    res.json({
      success: true,
      data: { config: REFERRAL_CONFIG },
    });
  } catch (error) {
    console.error('Error updating referral config:', error);
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
};

const getReferralConfig = async (req, res) => {
  res.json({
    success: true,
    data: { config: REFERRAL_CONFIG },
  });
};

module.exports = {
  getReferralCode,
  getReferralStats,
  recordShare,
  validateReferralCode,
  processReferralOnSignup,
  processReferralOnSubscription,
  getAdminReferralStats,
  updateReferralConfig,
  getReferralConfig,
  REFERRAL_CONFIG,
};
