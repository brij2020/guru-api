const User = require('../models/user');

exports.updatePreferences = async (req, res) => {
  try {
    const { lockDay, examSlug, stageSlug } = req.body;
    
    if (lockDay && !['friday', 'saturday'].includes(lockDay)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid lock day. Must be friday or saturday'
      });
    }

    const updateFields = {};
    
    if (lockDay !== undefined) {
      updateFields['preferences.lockDay'] = lockDay;
    }
    if (examSlug !== undefined) {
      updateFields['preferences.examSlug'] = examSlug;
    }
    if (stageSlug !== undefined) {
      updateFields['preferences.stageSlug'] = stageSlug;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        status: false,
        message: 'No valid preferences provided'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      status: false,
      message: 'Server error'
    });
  }
};

exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const defaultPreferences = {
      lockDay: 'friday',
      examSlug: 'ssc-cgl',
      stageSlug: 'tier-1'
    };

    res.status(200).json({
      status: true,
      data: {
        preferences: user.preferences || defaultPreferences
      }
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({
      status: false,
      message: 'Server error'
    });
  }
};
