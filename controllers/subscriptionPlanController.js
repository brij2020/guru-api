const SubscriptionPlan = require('../models/subscriptionPlan');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

const listPlans = async (req, res) => {
  try {
    const { active, featured } = req.query;
    
    const filter = {};
    if (active !== undefined) filter.isActive = active === 'true';
    if (featured === 'true') filter.isFeatured = true;
    
    const plans = await SubscriptionPlan.find(filter)
      .sort({ sortOrder: 1, 'pricing.monthly.amount': 1 })
      .lean();
    
    res.json({
      data: plans.map(plan => {
        const p = new SubscriptionPlan(plan);
        return p.toPublic();
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPlan = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    
    let plan;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      plan = await SubscriptionPlan.findById(idOrSlug);
    } else {
      plan = await SubscriptionPlan.findOne({ slug: idOrSlug });
    }
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const p = new SubscriptionPlan(plan);
    res.json({ data: p.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPlan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    
    const plan = new SubscriptionPlan({
      ...req.body,
      createdBy: req.user?.id,
    });
    
    await plan.save();
    res.status(201).json({ data: plan });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Plan slug already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const allowedUpdates = [
      'name', 'description', 'features', 'pricing', 'limits',
      'billing', 'examAccess', 'isActive', 'isFeatured', 'sortOrder', 'metadata'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    });
    
    await plan.save();
    res.json({ data: plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    await SubscriptionPlan.findByIdAndDelete(id);
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reorderPlans = async (req, res) => {
  try {
    const { planOrders } = req.body;
    
    if (!Array.isArray(planOrders)) {
      return res.status(400).json({ error: 'planOrders must be an array' });
    }
    
    const bulkOps = planOrders.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { sortOrder },
      },
    }));
    
    await SubscriptionPlan.bulkWrite(bulkOps);
    
    res.json({ message: 'Plans reordered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const duplicatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const original = await SubscriptionPlan.findById(id);
    if (!original) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const duplicate = new SubscriptionPlan({
      ...original.toObject(),
      _id: undefined,
      name: `${original.name} (Copy)`,
      slug: `${original.slug}-copy-${Date.now()}`,
      isActive: false,
      isFeatured: false,
      createdBy: req.user?.id,
    });
    
    await duplicate.save();
    res.status(201).json({ data: duplicate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  reorderPlans,
  duplicatePlan,
};
