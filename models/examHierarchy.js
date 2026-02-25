const mongoose = require('mongoose');

const ExamHierarchySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    tree: {
      type: [mongoose.Schema.Types.Mixed],
      required: true,
      default: [],
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Government Exams',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExamHierarchy', ExamHierarchySchema);
