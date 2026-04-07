const UserSubscription = require('../models/userSubscription');
const SubscriptionPlan = require('../models/subscriptionPlan');
const mongoose = require('mongoose');

const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'paused', 'trial'] },
    }).populate('planId');
    
    if (!subscription) {
      return res.json({ data: null });
    }
    
    res.json({ data: subscription.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscriptions = await UserSubscription.find({ userId })
      .populate('planId')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      data: subscriptions.map(sub => ({
        ...sub.toPublic(),
        history: true,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subscribeToPlan = async (req, res) => {
  try {
    const { planId, cycle } = req.body;
    const userId = req.user.id;
    
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }
    
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }
    
    const pricing = plan.pricing[cycle];
    if (!pricing || !pricing.enabled) {
      return res.status(400).json({ error: 'This billing cycle is not available' });
    }
    
    const existingActive = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'paused', 'trial'] },
    });
    
    if (existingActive) {
      existingActive.status = 'cancelled';
      existingActive.cancellation = {
        isCancelled: true,
        cancelledAt: new Date(),
        willExpireAt: existingActive.billing.endDate,
      };
      await existingActive.save();
    }
    
    const duration = cycle === 'yearly' ? 365 : 30;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    
    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: 'active',
      cycle,
      pricing: {
        amountPaid: pricing.amount,
        currency: pricing.currency,
      },
      billing: {
        startDate,
        endDate,
        nextBillingDate: cycle === 'monthly' ? endDate : null,
      },
      payment: {
        paymentGateway: 'free',
        paymentStatus: 'completed',
      },
      metadata: {
        source: 'website',
      },
    });
    
    await subscription.save();
    
    const populated = await UserSubscription.findById(subscription._id).populate('planId');
    
    res.status(201).json({ data: populated.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason } = req.body;
    
    const subscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'paused'] },
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    if (!subscription.planId?.billing?.cancelAnytime) {
      return res.status(400).json({ error: 'Cancellation not allowed for this plan' });
    }
    
    subscription.cancelSubscription(reason || 'User requested cancellation');
    await subscription.save();
    
    res.json({ data: subscription.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await UserSubscription.findOne({
      userId,
      status: 'cancelled',
      'cancellation.canReactivate': true,
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No cancellable subscription found' });
    }
    
    const plan = await SubscriptionPlan.findById(subscription.planId);
    const pricing = plan.pricing[subscription.cycle];
    
    const duration = subscription.cycle === 'yearly' ? 365 : 30;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    
    subscription.status = 'active';
    subscription.billing = {
      startDate,
      endDate,
      nextBillingDate: subscription.cycle === 'monthly' ? endDate : null,
    };
    subscription.cancellation = {
      isCancelled: false,
      cancelledAt: null,
      cancelReason: null,
      willExpireAt: null,
      canReactivate: true,
    };
    subscription.renewsAutomatically = true;
    
    await subscription.save();
    
    res.json({ data: subscription.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkMockTestAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'paused'] },
    }).populate('planId');
    
    if (!subscription) {
      return res.json({
        data: {
          allowed: true,
          reason: 'free_user',
          remaining: -1,
          message: 'Free tier - unlimited access',
        },
      });
    }
    
    const access = subscription.canTakeMockTest();
    
    if (!access.allowed) {
      let message = '';
      if (access.reason === 'weekly_limit') {
        message = `Weekly limit reached. Resets in ${Math.ceil((7 - new Date().getDay()))} days`;
      } else if (access.reason === 'monthly_limit') {
        message = 'Monthly limit reached. Resets next month';
      }
      
      return res.json({
        data: {
          allowed: false,
          reason: access.reason,
          remaining: 0,
          message,
        },
      });
    }
    
    res.json({
      data: {
        allowed: true,
        remaining: access.remaining,
        weeklyRemaining: access.weeklyRemaining,
        monthlyRemaining: access.monthlyRemaining,
        message: `${access.remaining} mock tests remaining`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const recordMockTestTaken = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'paused'] },
    });
    
    if (subscription) {
      subscription.incrementMockTestUsage();
      await subscription.save();
    }
    
    res.json({ data: { success: true } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminUserSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, planId, search } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (planId) filter.planId = planId;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [subscriptions, total] = await Promise.all([
      UserSubscription.find(filter)
        .populate('userId', 'name email phone')
        .populate('planId', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      UserSubscription.countDocuments(filter),
    ]);
    
    res.json({
      data: subscriptions.map(sub => sub.toPublic()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const adminUpdateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, endDate, addDays, notes } = req.body;
    
    const subscription = await UserSubscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    if (status) subscription.status = status;
    if (endDate) subscription.billing.endDate = new Date(endDate);
    if (addDays) {
      const newEnd = new Date(subscription.billing.endDate);
      newEnd.setDate(newEnd.getDate() + addDays);
      subscription.billing.endDate = newEnd;
    }
    if (notes) subscription.metadata.notes = notes;
    
    await subscription.save();
    
    res.json({ data: subscription.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const adminCreateSubscription = async (req, res) => {
  try {
    const { userId, planId, cycle, durationDays, notes } = req.body;
    
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const pricing = plan.pricing[cycle] || plan.pricing.monthly;
    
    const startDate = new Date();
    const duration = durationDays || (cycle === 'yearly' ? 365 : 30);
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    
    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: 'active',
      cycle,
      pricing: {
        amountPaid: pricing.amount,
        currency: pricing.currency,
      },
      billing: {
        startDate,
        endDate,
      },
      payment: {
        paymentGateway: 'admin',
        paymentStatus: 'completed',
      },
      metadata: {
        source: 'admin',
        notes: notes || 'Created by admin',
      },
    });
    
    await subscription.save();
    
    const populated = await UserSubscription.findById(subscription._id)
      .populate('userId', 'name email phone')
      .populate('planId');
    
    res.status(201).json({ data: populated.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUserSubscription,
  getUserSubscriptionHistory,
  subscribeToPlan,
  cancelSubscription,
  reactivateSubscription,
  checkMockTestAccess,
  recordMockTestTaken,
  getAdminUserSubscriptions,
  adminUpdateSubscription,
  adminCreateSubscription,
};
