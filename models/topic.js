const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Topic name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
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

TopicSchema.index({ owner: 1, category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Topic', TopicSchema);
