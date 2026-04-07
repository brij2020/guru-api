const User = require('../models/user');

const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ 
      role: { $in: ['admin', 'editor', 'reviewer', 'super_admin'] } 
    }).select('-password -refreshToken').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    next(error);
  }
};

const getAdminById = async (req, res, next) => {
  try {
    const admin = await User.findById(req.params.id).select('-password -refreshToken');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }
    
    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    next(error);
  }
};

const getMyPermissions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        role: user.role,
        actualRole: user.actualRole,
        adminPermissions: user.adminPermissions ? Object.fromEntries(user.adminPermissions) : {}
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateAdminPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, actualRole, adminPermissions } = req.body;
    
    const admin = await User.findById(id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }
    
    if (role) admin.role = role;
    if (actualRole) admin.actualRole = actualRole;
    if (adminPermissions) {
      const permMap = new Map();
      for (const [key, value] of Object.entries(adminPermissions)) {
        permMap.set(key, value);
      }
      admin.adminPermissions = permMap;
    }
    
    await admin.save();
    
    res.json({
      success: true,
      data: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        actualRole: admin.actualRole,
        adminPermissions: admin.adminPermissions ? Object.fromEntries(admin.adminPermissions) : {}
      }
    });
  } catch (error) {
    next(error);
  }
};

const checkPermission = async (req, res, next) => {
  try {
    const { permission, section, level } = req.query;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.role === 'super_admin') {
      return res.json({
        success: true,
        data: { hasPermission: true, isSuperAdmin: true }
      });
    }
    
    let hasPermission = false;
    
    if (permission) {
      hasPermission = user.hasPermission ? user.hasPermission(permission, level || 'read') : false;
    } else if (section) {
      hasPermission = user.hasPermission ? user.hasPermission(section, level || 'read') : false;
    }
    
    res.json({
      success: true,
      data: { hasPermission, isSuperAdmin: false }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAdmins,
  getAdminById,
  updateAdminPermissions,
  checkPermission,
  getMyPermissions
};
