const { logger } = require('../config/logger');
const testAttemptService = require('../services/testAttemptService');
const { validateStartTestAttempt } = require('../validators/testAttemptValidator');

const startTestAttempt = async (req, res) => {
  const payload = validateStartTestAttempt(req.body);
  const attempt = await testAttemptService.startTestAttempt(payload, req.user.id);
  logger.info('Test attempt started', { attemptId: attempt._id, userId: req.user.id });
  res.status(201).json({ data: attempt });
};

module.exports = {
  startTestAttempt,
};
