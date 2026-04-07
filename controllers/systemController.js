const ApiError = require('../errors/apiError');
const systemMetricsService = require('../services/systemMetricsService');

const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

const getMetrics = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Only admin users can view system metrics');
  }

  const metrics = await systemMetricsService.getSystemMetrics();
  res.json({
    data: {
      generatedAt: new Date().toISOString(),
      ...metrics,
    },
  });
};

module.exports = {
  getMetrics,
};
