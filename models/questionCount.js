const mongoose = require('mongoose');

const QuestionCountSchema = new mongoose.Schema(
  {
    count: {
      type: Number,
      required: [true, 'Question count is required'],
      min: 1,
      max: 500,
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

QuestionCountSchema.index({ owner: 1, count: 1 }, { unique: true });

module.exports = mongoose.model('QuestionCount', QuestionCountSchema);
