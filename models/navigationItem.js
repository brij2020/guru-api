const mongoose = require('mongoose');

const NavigationItemSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  type: {
    type: String,
    enum: ['admin', 'user', 'gov_exam'],
    required: true,
    index: true,
  },
  label: {
    type: String,
    trim: true,
    required: true,
    maxlength: 100,
  },
  labelHi: {
    type: String,
    trim: true,
    default: '',
    maxlength: 100,
  },
  seo: {
    type: String,
    trim: true,
    required: true,
    maxlength: 200,
  },
  permission: {
    type: String,
    trim: true,
    default: '',
    maxlength: 50,
  },
  minRole: {
    type: String,
    enum: ['', 'super_admin', 'admin', 'editor', 'reviewer'],
    default: '',
  },
  icon: {
    type: String,
    trim: true,
    default: '',
    maxlength: 50,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationItem',
    default: null,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

NavigationItemSchema.index({ owner: 1, type: 1, order: 1 });
NavigationItemSchema.index({ owner: 1, type: 1, isActive: 1 });

NavigationItemSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    type: this.type,
    label: this.label,
    labelHi: this.labelHi,
    seo: this.seo,
    permission: this.permission,
    minRole: this.minRole,
    icon: this.icon,
    parentId: this.parentId,
    order: this.order,
    isActive: this.isActive,
    isVisible: this.isVisible,
    isPublic: this.isPublic,
  };
};

module.exports = mongoose.model('NavigationItem', NavigationItemSchema);