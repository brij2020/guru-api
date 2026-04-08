const Story = require('../models/story');

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

const getCategories = (req, res) => {
  res.json({
    success: true,
    data: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  });
};

const create = async (req, res) => {
  try {
    const { title, slug, excerpt, content, coverImage, category, tags, status, featured } = req.body;
    
    const story = new Story({
      title,
      slug: slug || title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      excerpt,
      content,
      coverImage,
      category,
      tags,
      status,
      featured,
      author: req.user?.id || null,
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

module.exports = { getAll, getBySlug, getCategories, create, update, remove };
