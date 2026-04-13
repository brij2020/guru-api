const mongoose = require('mongoose');
const Bookmark = require('../models/bookmark');

class BookmarkService {
  async addBookmark(userId, questionId, source = 'other') {
    const existing = await Bookmark.findOne({ user: new mongoose.Types.ObjectId(userId), questionId });
    if (existing) {
      return { bookmarked: true, alreadyExists: true };
    }

    const bookmark = new Bookmark({ user: new mongoose.Types.ObjectId(userId), questionId, source });
    await bookmark.save();
    return { bookmarked: true, alreadyExists: false };
  }

  async removeBookmark(userId, questionId) {
    const result = await Bookmark.deleteOne({ user: new mongoose.Types.ObjectId(userId), questionId });
    return { removed: result.deletedCount > 0 };
  }

  async toggleBookmark(userId, questionId, source = 'other') {
    const existing = await Bookmark.findOne({ user: new mongoose.Types.ObjectId(userId), questionId });
    if (existing) {
      await Bookmark.deleteOne({ _id: existing._id });
      return { bookmarked: false };
    }

    const bookmark = new Bookmark({ user: new mongoose.Types.ObjectId(userId), questionId, source });
    await bookmark.save();
    return { bookmarked: true };
  }

  async getUserBookmarks(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [bookmarks, total] = await Promise.all([
      Bookmark.find({ user: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bookmark.countDocuments({ user: new mongoose.Types.ObjectId(userId) })
    ]);

    return {
      bookmarks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async isBookmarked(userId, questionId) {
    const bookmark = await Bookmark.findOne({ user: new mongoose.Types.ObjectId(userId), questionId });
    return { isBookmarked: !!bookmark };
  }

  async getBookmarkedQuestionIds(userId, questionIds) {
    const bookmarks = await Bookmark.find({
      user: new mongoose.Types.ObjectId(userId),
      questionId: { $in: questionIds }
    }).select('questionId').lean();

    const bookmarkedSet = new Set(bookmarks.map(b => b.questionId));
    return questionIds.map(id => ({
      questionId: id,
      isBookmarked: bookmarkedSet.has(id)
    }));
  }

  async removeAllBookmarks(userId) {
    const result = await Bookmark.deleteMany({ user: new mongoose.Types.ObjectId(userId) });
    return { removed: result.deletedCount };
  }
}

module.exports = new BookmarkService();
