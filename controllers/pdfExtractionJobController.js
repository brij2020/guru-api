const ApiError = require('../errors/apiError');
const pdfExtractionJobService = require('../services/pdfExtractionJobService');
const {
  validateCreatePdfJob,
  validateListPdfJobsQuery,
} = require('../validators/questionBankValidator');

const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

const assertAdmin = (user) => {
  if (!isAdmin(user?.role)) {
    throw new ApiError(403, 'Only admin users can manage PDF extraction jobs');
  }
};

const createPdfJob = async (req, res) => {
  assertAdmin(req.user);
  const payload = validateCreatePdfJob(req.body || {});
  const data = await pdfExtractionJobService.createJob({
    ownerId: req.user.id,
    payload,
  });
  res.status(201).json({ data });
};

const listPdfJobs = async (req, res) => {
  assertAdmin(req.user);
  const query = validateListPdfJobsQuery(req.query || {});
  const items = await pdfExtractionJobService.listJobs({
    ownerId: req.user.id,
    limit: query.limit,
  });
  res.json({ data: { items } });
};

const getPdfJob = async (req, res) => {
  assertAdmin(req.user);
  const data = await pdfExtractionJobService.getJob({
    ownerId: req.user.id,
    id: String(req.params?.id || ''),
  });
  res.json({ data });
};

const runPdfJob = async (req, res) => {
  assertAdmin(req.user);
  const data = await pdfExtractionJobService.runJob({
    ownerId: req.user.id,
    id: String(req.params?.id || ''),
  });
  res.json({ data });
};

const importPdfJob = async (req, res) => {
  assertAdmin(req.user);
  const data = await pdfExtractionJobService.importJobOutputs({
    ownerId: req.user.id,
    id: String(req.params?.id || ''),
  });
  res.json({ data });
};

module.exports = {
  createPdfJob,
  listPdfJobs,
  getPdfJob,
  runPdfJob,
  importPdfJob,
};
