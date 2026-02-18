const registerAuthRoutes = require('./v1/auth');
const registerTaskRoutes = require('./v1/tasks');

module.exports = (app) => {
  registerAuthRoutes(app);
  registerTaskRoutes(app);
};
