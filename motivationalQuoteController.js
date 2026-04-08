const MotivationalQuote = require('../models/motivationalQuote');
const ApiError = require('../errors/apiError');

const getAll = async (req, res) => {
  const quotes = await MotivationalQuote.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ data: quotes });
};

const getRandom = async (req, res) => {
  const count = await MotivationalQuote.countDocuments({ isActive: true });
  if (count === 0) {
    return res.json({ data: null });
  }
  const random = Math.floor(Math.random() * count);
  const quote = await MotivationalQuote.findOne({ isActive: true })
    .skip(random)
    .lean();
  res.json({ data: quote });
};

const create = async (req, res) => {
  const { text, text_hi, author, isActive } = req.body;
  const quote = await MotivationalQuote.create({ text, text_hi, author, isActive });
  res.status(201).json({ data: quote });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { text, text_hi, author, isActive } = req.body;
  const quote = await MotivationalQuote.findByIdAndUpdate(
    id,
    { text, text_hi, author, isActive },
    { new: true, runValidators: true }
  );
  if (!quote) {
    throw new ApiError(404, 'Quote not found');
  }
  res.json({ data: quote });
};

const remove = async (req, res) => {
  const { id } = req.params;
  const quote = await MotivationalQuote.findByIdAndDelete(id);
  if (!quote) {
    throw new ApiError(404, 'Quote not found');
  }
  res.json({ message: 'Quote deleted' });
};

module.exports = { getAll, getRandom, create, update, remove };
