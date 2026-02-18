const registerAuthRoutes = require('./v1/auth');
const registerTaskRoutes = require('./v1/tasks');
const registerCategoryRoutes = require('./v1/categories');
const registerUserRoutes = require('./v1/users');

module.exports = (app) => {
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerTaskRoutes(app);
  registerCategoryRoutes(app);
};
