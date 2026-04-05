const { logger } = require('../config/logger');
const testAttemptService = require('../services/testAttemptService');
const {
  validateStartTestAttempt,
  validateCompleteTestAttempt,
} = require('../validators/testAttemptValidator');

const startTestAttempt = async (req, res) => {
  const payload = validateStartTestAttempt(req.body);
  const attempt = await testAttemptService.startTestAttempt(payload, req.user.id);
  logger.info('Test attempt started', { attemptId: attempt._id, userId: req.user.id });
  res.status(201).json({ data: attempt });
};

const completeTestAttempt = async (req, res) => {
  const payload = validateCompleteTestAttempt(req.body || {});
  const attempt = await testAttemptService.completeTestAttempt(payload, req.user.id);
  logger.info('Test attempt completed', { attemptId: attempt._id, userId: req.user.id });
  res.json({ data: attempt });
};

const getTestAttempt = async (req, res) => {
  const hydrate = String(req.query?.hydrate || 'true').trim().toLowerCase() !== 'false';
  const attempt = await testAttemptService.getTestAttempt(req.params.id, req.user.id, { hydrate });
  res.json({ data: attempt });
};

const listTestAttempts = async (req, res) => {
  const result = await testAttemptService.listTestAttempts(req.user.id);
  res.json({ data: result });
};

module.exports = {
  startTestAttempt,
  completeTestAttempt,
  getTestAttempt,
  listTestAttempts,
};
