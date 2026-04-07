const User = require('../models/user');

const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const adminRoles = ['admin', 'super_admin'];
    
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Admin check failed' 
    });
  }
};

module.exports = isAdmin;
