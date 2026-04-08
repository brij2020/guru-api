const mongoose = require('mongoose');
const ApiError = require('../errors/apiError');
const authService = require('../services/authService');

const extractBearerToken = (authorization = '') => {
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
};

const authenticate = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return next(new ApiError(401, 'Authorization token is required'));
    }

    const payload = authService.verifyAccessToken(token);
    const dbUser = await mongoose.connection.db.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(payload.sub) },
      { projection: { adminPermissions: 1, role: 1, email: 1 } }
    );

    if (!dbUser) {
      return next(new ApiError(401, 'Authenticated user no longer exists'));
    }

    let adminPerms = {};
    if (dbUser.adminPermissions) {
      if (dbUser.adminPermissions instanceof Map) {
        adminPerms = Object.fromEntries(dbUser.adminPermissions.entries());
      } else if (typeof dbUser.adminPermissions === 'object') {
        adminPerms = { ...dbUser.adminPermissions };
      }
    }

    req.user = {
      id: payload.sub,
      role: dbUser.role,
      email: dbUser.email,
      adminPermissions: adminPerms,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authenticate;
