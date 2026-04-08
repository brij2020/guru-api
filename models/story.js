const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  excerpt: {
    type: String,
    maxlength: 300,
  },
  content: {
    type: String,
    required: true,
  },
  coverImage: {
    type: String,
    default: null,
  },
  category: {
    type: String,
    required: true,
    enum: ['important-updates', 'preparation-strategies', 'student-resources'],
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  views: {
    type: Number,
    default: 0,
  },
  publishedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

storySchema.index({ status: 1, publishedAt: -1 });
storySchema.index({ category: 1, status: 1, publishedAt: -1 });

storySchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

storySchema.methods.toPublic = function() {
  return {
    _id: this._id,
    title: this.title,
    slug: this.slug,
    excerpt: this.excerpt,
    content: this.content,
    coverImage: this.coverImage,
    category: this.category,
    tags: this.tags,
    author: this.author,
    status: this.status,
    featured: this.featured,
    views: this.views,
    publishedAt: this.publishedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Story', storySchema);
