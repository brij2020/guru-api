const ApiError = require('../errors/apiError');
const { logger } = require('../config/logger');
const aiGenerationJobService = require('../services/aiGenerationJobService');
const {
  validateCreateJobPayload,
  validateListJobsQuery,
  validateJobIdParam,
  validateProcessJobPayload,
  validateWorkerRunPayload,
} = require('../validators/aiGenerationJobValidator');

const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

const ensureAdmin = (req) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Only admin users can manage AI generation jobs');
  }
};

const createJob = async (req, res) => {
  ensureAdmin(req);
  const payload = validateCreateJobPayload(req.body || {});
  const job = await aiGenerationJobService.createJob(req.user.id, payload);

  logger.info('AI generation job created', {
    owner: req.user.id,
    jobId: job.id,
    totalQuestions: payload.totalQuestions,
    batchSize: payload.batchSize,
    provider: payload.provider,
  });

  res.status(201).json({ data: job });
};

const listJobs = async (req, res) => {
  ensureAdmin(req);
  const filters = validateListJobsQuery(req.query || {});
  const result = await aiGenerationJobService.listJobs(req.user.id, filters);
  res.json({ data: result });
};

const getJob = async (req, res) => {
  ensureAdmin(req);
  const { jobId } = validateJobIdParam(req.params || {});
  const job = await aiGenerationJobService.getJobById(req.user.id, jobId);
  res.json({ data: job });
};

const processNextJob = async (req, res) => {
  ensureAdmin(req);
  const payload = validateProcessJobPayload(req.body || {});
  const result = await aiGenerationJobService.processJob(req.user.id, payload.jobId || '');

  logger.info('AI generation job batch processed', {
    owner: req.user.id,
    processed: result.processed,
    jobId: result?.job?.id || payload.jobId || null,
    batchStatus: result?.batch?.status || null,
    generatedCount: result?.batch?.generatedCount || 0,
    insertedOrUpdatedCount: result?.batch?.insertedOrUpdatedCount || 0,
  });

  res.json({ data: result });
};

const workerRun = async (req, res) => {
  const payload = validateWorkerRunPayload(req.body || {});
  const result = await aiGenerationJobService.processJob(payload.ownerId, payload.jobId || '');
  res.json({ data: result });
};

module.exports = {
  createJob,
  listJobs,
  getJob,
  processNextJob,
  workerRun,
};
