const User = require('../models/user');
const authService = require('../services/authService');

const extractBearerToken = (authorization = '') => {
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return next();
    }

    const payload = authService.verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      return next();
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    };
    return next();
  } catch (error) {
    return next();
  }
};

module.exports = optionalAuthenticate;
