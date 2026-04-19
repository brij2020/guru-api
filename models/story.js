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
  coverImageAlt: {
    type: String,
    maxlength: 200,
    default: '',
  },
  category: {
    type: String,
    default: 'general',
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
  authorName: {
    type: String,
    default: '',
  },
  authorBio: {
    type: String,
    default: '',
  },
  authorImage: {
    type: String,
    default: '',
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
  scheduledAt: {
    type: Date,
    default: null,
  },
  seo: {
    metaTitle: { type: String, maxlength: 70, default: '' },
    metaDescription: { type: String, maxlength: 160, default: '' },
    metaKeywords: [{ type: String }],
    canonicalUrl: { type: String, default: '' },
  },
  social: {
    ogImage: { type: String, default: '' },
    twitterCard: { type: String, enum: ['summary', 'summary_large_image', 'app', 'player'], default: 'summary_large_image' },
  },
  readingTime: {
    type: Number,
    default: 0,
  },
  readCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

storySchema.index({ status: 1, publishedAt: -1 });
storySchema.index({ category: 1, status: 1, publishedAt: -1 });
storySchema.index({ featured: 1, status: 1, publishedAt: -1 });
storySchema.index({ tags: 1 });
storySchema.index({ title: 'text', excerpt: 'text', content: 'text' });

storySchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (this.isModified('content')) {
    const wordsPerMinute = 200;
    const wordCount = this.content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / wordsPerMinute);
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
    coverImageAlt: this.coverImageAlt,
    category: this.category,
    tags: this.tags,
    author: this.author,
    authorName: this.authorName,
    authorBio: this.authorBio,
    authorImage: this.authorImage,
    status: this.status,
    featured: this.featured,
    views: this.views,
    publishedAt: this.publishedAt,
    scheduledAt: this.scheduledAt,
    seo: this.seo,
    social: this.social,
    readingTime: this.readingTime,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Story', storySchema);
