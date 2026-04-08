const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user');
const Category = require('../models/category');
const Topic = require('../models/topic');
const QuestionStyle = require('../models/questionStyle');
const QuestionCount = require('../models/questionCount');
const ApiError = require('../errors/apiError');
const {
  jwtSecret,
  jwtRefreshSecret,
  jwtExpiresIn,
  jwtRefreshExpiresIn,
} = require('../config/env');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const DEFAULT_AI_TEST_CATEGORY_NAME = 'AI Test';
const DEFAULT_AI_TEST_CATEGORY_DESCRIPTION = 'Default category for AI test items';
const DEFAULT_JAVASCRIPT_CATEGORY_NAME = 'JavaScript';
const DEFAULT_JAVASCRIPT_CATEGORY_DESCRIPTION = 'Core JavaScript concepts and interview topics';
const DEFAULT_JAVASCRIPT_TOPICS = [
  'Event Loop',
  'Event Delegation',
  'Promise',
];
const DEFAULT_JAVASCRIPT_QUESTION_STYLES = [
  'MCQ',
  'Output Based',
  'Problem Solving',
];
const DEFAULT_QUESTION_COUNTS = [5, 10, 20, 30];

const ensureDefaultLearningContent = async (userId) => {
  await Category.findOneAndUpdate(
    { owner: userId, name: DEFAULT_AI_TEST_CATEGORY_NAME },
    {
      $setOnInsert: {
        description: DEFAULT_AI_TEST_CATEGORY_DESCRIPTION,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  const javascriptCategory = await Category.findOneAndUpdate(
    { owner: userId, name: DEFAULT_JAVASCRIPT_CATEGORY_NAME },
    {
      $setOnInsert: {
        description: DEFAULT_JAVASCRIPT_CATEGORY_DESCRIPTION,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await Promise.all(
    DEFAULT_JAVASCRIPT_TOPICS.map((topicName) =>
      Topic.findOneAndUpdate(
        {
          owner: userId,
          category: javascriptCategory._id,
          name: topicName,
        },
        {
          $setOnInsert: {
            description: '',
          },
        },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
    )
  );

  await Promise.all(
    DEFAULT_JAVASCRIPT_QUESTION_STYLES.map((style) =>
      QuestionStyle.findOneAndUpdate(
        {
          owner: userId,
          category: javascriptCategory._id,
          style,
        },
        { $setOnInsert: {} },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
    )
  );

  await Promise.all(
    DEFAULT_QUESTION_COUNTS.map((count) =>
      QuestionCount.findOneAndUpdate(
        {
          owner: userId,
          count,
        },
        { $setOnInsert: {} },
        {
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
    )
  );
};

const createAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });

const createRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString(), type: 'refresh' }, jwtRefreshSecret, {
    expiresIn: jwtRefreshExpiresIn,
  });

const sanitizeUser = (user) => {
  let adminPerms = {};
  if (user.adminPermissions) {
    if (user.adminPermissions instanceof Map) {
      adminPerms = Object.fromEntries(user.adminPermissions.entries());
    } else if (typeof user.adminPermissions === 'object') {
      adminPerms = { ...user.adminPermissions };
    }
  }
  
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    adminPermissions: adminPerms,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const issueTokens = async (user) => {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'Email is already in use');
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
  });

  await ensureDefaultLearningContent(user._id);

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshTokenHash');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Fetch adminPermissions separately using raw MongoDB query
  const dbUser = await mongoose.connection.db.collection('users').findOne(
    { _id: user._id },
    { projection: { adminPermissions: 1 } }
  );
  user.adminPermissions = dbUser?.adminPermissions || {};

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token is required');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, jwtRefreshSecret);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new ApiError(401, 'Invalid refresh token type');
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash) {
    throw new ApiError(401, 'Refresh token is not active');
  }

  if (hashToken(refreshToken) !== user.refreshTokenHash) {
    throw new ApiError(401, 'Refresh token is not active');
  }

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
};

const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return sanitizeUser(user);
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired access token');
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getProfile,
  verifyAccessToken,
};
