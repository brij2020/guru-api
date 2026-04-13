const bookmarkService = require('../services/bookmarkService');

const add = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { questionId, source } = req.body;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    const result = await bookmarkService.addBookmark(userId, questionId, source);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.params;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    const result = await bookmarkService.removeBookmark(userId, questionId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const toggle = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    const result = await bookmarkService.toggleBookmark(userId, questionId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await bookmarkService.getUserBookmarks(userId, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const check = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.params;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    const result = await bookmarkService.isBookmarked(userId, questionId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const checkMany = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { questionIds } = req.body;

    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'questionIds array is required' });
    }

    const result = await bookmarkService.getBookmarkedQuestionIds(userId, questionIds);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  add,
  remove,
  toggle,
  list,
  check,
  checkMany,
};
