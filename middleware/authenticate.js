const User = require('../models/user');
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
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(new ApiError(401, 'Authorization token is required'));
  }

  const payload = authService.verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user) {
    return next(new ApiError(401, 'Authenticated user no longer exists'));
  }

  req.user = {
    id: user._id.toString(),
    role: user.role,
    email: user.email,
  };
  return next();
};

module.exports = authenticate;
