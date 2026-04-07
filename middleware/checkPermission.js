const User = require('../models/user');

const checkPermission = (section, requiredLevel = 'read') => {
  return async (req, res, next) => {
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

      if (user.role === 'super_admin') {
        return next();
      }

      if (!['admin', 'editor', 'reviewer'].includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      const hasPermission = user.hasPermission(section, requiredLevel);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions for this action' 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Permission check failed' 
      });
    }
  };
};

module.exports = checkPermission;
