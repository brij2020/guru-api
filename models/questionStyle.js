const mongoose = require('mongoose');

const QuestionStyleSchema = new mongoose.Schema(
  {
    style: {
      type: String,
      required: [true, 'Question style is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

QuestionStyleSchema.index({ owner: 1, category: 1, style: 1 }, { unique: true });

module.exports = mongoose.model('QuestionStyle', QuestionStyleSchema);
