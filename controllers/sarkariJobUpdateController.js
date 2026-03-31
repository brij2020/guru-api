const SarkariJobUpdate = require('../models/sarkariJobUpdate');
const ApiError = require('../errors/apiError');

const getAll = async (req, res) => {
  const { category, isActive, page = 1, limit = 50 } = req.query;
  
  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [updates, total] = await Promise.all([
    SarkariJobUpdate.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SarkariJobUpdate.countDocuments(filter),
  ]);
  
  res.json({ 
    data: updates,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
};

const getById = async (req, res) => {
  const { id } = req.params;
  const update = await SarkariJobUpdate.findById(id).lean();
  if (!update) {
    throw new ApiError(404, 'Job update not found');
  }
  res.json({ data: update });
};

const getByCategory = async (req, res) => {
  const { category } = req.params;
  const updates = await SarkariJobUpdate.find({ category, isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ data: updates });
};

const create = async (req, res) => {
  const update = await SarkariJobUpdate.create(req.body);
  res.status(201).json({ data: update });
};

const update = async (req, res) => {
  const { id } = req.params;
  const update = await SarkariJobUpdate.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!update) {
    throw new ApiError(404, 'Job update not found');
  }
  res.json({ data: update });
};

const remove = async (req, res) => {
  const { id } = req.params;
  const update = await SarkariJobUpdate.findByIdAndDelete(id);
  if (!update) {
    throw new ApiError(404, 'Job update not found');
  }
  res.json({ message: 'Job update deleted successfully' });
};

const getAllPublic = async (req, res) => {
  const { category, page = 1, limit = 50 } = req.query;
  
  const filter = { isActive: true };
  if (category) filter.category = category;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [updates, total] = await Promise.all([
    SarkariJobUpdate.find(filter)
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SarkariJobUpdate.countDocuments(filter),
  ]);
  
  res.json({ 
    data: updates,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
};

const getByIdPublic = async (req, res) => {
  const { id } = req.params;
  const update = await SarkariJobUpdate.findOne({ _id: id, isActive: true }).lean();
  if (!update) {
    throw new ApiError(404, 'Job update not found');
  }
  res.json({ data: update });
};

const getByCategoryPublic = async (req, res) => {
  const { category } = req.params;
  const updates = await SarkariJobUpdate.find({ category, isActive: true })
    .sort({ isFeatured: -1, createdAt: -1 })
    .lean();
  res.json({ data: updates });
};

module.exports = { getAll, getById, getByCategory, create, update, remove, getAllPublic, getByIdPublic, getByCategoryPublic };
