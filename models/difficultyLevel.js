const mongoose = require('mongoose');

const DifficultyLevelSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: [true, 'Difficulty level is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
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

DifficultyLevelSchema.index({ owner: 1, level: 1 }, { unique: true });

module.exports = mongoose.model('DifficultyLevel', DifficultyLevelSchema);
