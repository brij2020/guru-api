const mongoose = require('mongoose');

const motivationalSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    text_hi: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    author: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

motivationalSchema.index({ isActive: 1 });

module.exports = mongoose.model('MotivationalQuote', motivationalSchema);
