const ApiError = require('../errors/apiError');
const systemMetricsService = require('../services/systemMetricsService');

const getMetrics = async (req, res) => {
  if (req.user?.role !== 'admin') {
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
