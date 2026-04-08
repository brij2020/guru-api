const authenticate = require('./authenticate');

const isAdmin = async (req, res, next) => {
  await authenticate(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return next(new (require('../errors/apiError'))(403, 'Admin access required'));
    }
    return next();
  });
};

module.exports = isAdmin;
