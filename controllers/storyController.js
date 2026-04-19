const Story = require('../models/story');
const asyncHandler = require('../middleware/asyncHandler');

const CATEGORY_LABELS = {
  'important-updates': 'Important Updates',
  'preparation-strategies': 'Preparation Strategies',
  'student-resources': 'Student Resources',
};

const getAll = async (req, res) => {
  try {
    const { category, status, featured, limit = 20, page = 1 } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    else filter.status = 'published';
    if (featured === 'true') filter.featured = true;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [stories, total] = await Promise.all([
      Story.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'name email'),
      Story.countDocuments(filter),
    ]);
    
    res.json({
      success: true,
      data: {
        stories: stories.map(s => s.toPublic()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stories' });
  }
};

const getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const story = await Story.findOne({ slug, status: 'published' })
      .populate('author', 'name email');
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    
    story.views += 1;
    await story.save();
    
    res.json({ success: true, data: story.toPublic() });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch story' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id).populate('author', 'name email');
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    
    res.json({ success: true, data: story.toPublic() });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch story' });
  }
};

const getCategories = (req, res) => {
  res.json({
    success: true,
    data: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  });
};

const create = async (req, res) => {
  try {
    const {
      title, slug, excerpt, content, coverImage, coverImageAlt,
      category, tags, status, featured,
      authorName, authorBio, authorImage,
      scheduledAt, seo, social
    } = req.body;
    
    const story = new Story({
      title,
      slug: slug || title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      excerpt,
      content,
      coverImage,
      coverImageAlt,
      category,
      tags,
      status,
      featured,
      author: req.user?.id || null,
      authorName,
      authorBio,
      authorImage,
      scheduledAt,
      seo,
      social,
    });
    
    await story.save();
    
    res.status(201).json({ success: true, data: story.toPublic() });
  } catch (error) {
    console.error('Error creating story:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Slug already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create story' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const story = await Story.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    
    res.json({ success: true, data: story.toPublic() });
  } catch (error) {
    console.error('Error updating story:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Slug already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update story' });
  }
};

const search = async (req, res) => {
  try {
    const { q, category, limit = 20, page = 1 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }
    
    const filter = {
      status: 'published',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { excerpt: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
      ],
    };
    if (category) filter.category = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [stories, total] = await Promise.all([
      Story.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'name email'),
      Story.countDocuments(filter),
    ]);
    
    res.json({
      success: true,
      data: {
        stories: stories.map(s => s.toPublic()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error searching stories:', error);
    res.status(500).json({ success: false, error: 'Failed to search stories' });
  }
};

const getRelated = async (req, res) => {
  try {
    const { id, limit = 4 } = req.params;
    
    const story = await Story.findById(id);
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    
    const related = await Story.find({
      _id: { $ne: story._id },
      status: 'published',
      $or: [
        { category: story.category },
        { tags: { $in: story.tags } },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select('title slug excerpt coverImage category publishedAt readingTime')
      .lean();
    
    res.json({ success: true, data: related });
  } catch (error) {
    console.error('Error fetching related stories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch related stories' });
  }
};

const getFeatured = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const featured = await Story.find({
      status: 'published',
      featured: true,
    })
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select('title slug excerpt coverImage category publishedAt readingTime')
      .lean();
    
    res.json({ success: true, data: featured });
  } catch (error) {
    console.error('Error fetching featured stories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured stories' });
  }
};

const incrementView = async (req, res) => {
  try {
    const { id } = req.params;
    
    const story = await Story.findByIdAndUpdate(
      id,
      { $inc: { views: 1, readCount: 1 } },
      { new: true }
    );
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    
    res.json({ success: true, data: { views: story.views } });
  } catch (error) {
    console.error('Error incrementing view:', error);
    res.status(500).json({ success: false, error: 'Failed to increment view' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findByIdAndDelete(id);
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }
    
    res.json({ success: true, message: 'Story deleted' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ success: false, error: 'Failed to delete story' });
  }
};

module.exports = { getAll, getBySlug, getById, getCategories, create, update, remove, search, getRelated, getFeatured, incrementView };
