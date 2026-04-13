const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questionId: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['mock', 'practice', 'daily', 'other'],
    default: 'other',
  },
}, {
  timestamps: true,
});

bookmarkSchema.index({ user: 1, questionId: 1 }, { unique: true });
bookmarkSchema.index({ questionId: 1 });
bookmarkSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
