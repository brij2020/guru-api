const crypto = require('crypto');
const ApiError = require('../errors/apiError');
const AiGenerationJob = require('../models/aiGenerationJob');
const AiGenerationOutput = require('../models/aiGenerationOutput');
const aiCurationService = require('./aiCurationService');
const questionBankService = require('./questionBankService');

const STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const REAL_EXAM_TOPICS = {
  'sbi-clerk:prelims': [
    'English Language',
    'Reading Comprehension',
    'Cloze Test',
    'Fill in the blanks',
    'Para Jumbles',
    'Error Detection',
    'Numerical Ability',
    'Simplification',
    'Data Interpretation',
    'Quadratic Equations',
    'Number Series',
    'Reasoning Ability',
    'Puzzles',
    'Seating Arrangement',
    'Puzzle / Seating Arrangement',
    'Syllogism',
    'Coding Decoding',
    'Statement based MCQ',
    'Assertion Reason',
    'Mathematical Word Problems',
  ],
  'ssc-cgl:tier-1': [
    'General Intelligence and Reasoning',
    'Analogy',
    'Classification',
    'Series',
    'General Awareness',
    'History',
    'Geography',
    'Polity',
    'Quantitative Aptitude',
    'Percentage',
    'Profit and Loss',
    'Time and Work',
    'English Comprehension',
    'Reading Comprehension',
    'Cloze Test',
    'Fill in the blanks',
    'Error Detection',
    'Para Jumbles',
    'Vocabulary',
    'Grammar',
    'Data Interpretation',
    'Puzzle / Seating Arrangement',
    'Coding Decoding',
    'Syllogism',
    'Statement based MCQ',
    'Assertion Reason',
    'Mathematical Word Problems',
  ],
  'rrb-ntpc:cbt-1': [
    'General Awareness',
    'Current Affairs',
    'Indian Economy',
    'Mathematics',
    'Arithmetic',
    'Simplification',
    'Number System',
    'General Intelligence and Reasoning',
    'Statement Conclusion',
    'Puzzles',
    'Puzzle / Seating Arrangement',
    'Coding Decoding',
    'Reading Comprehension',
    'Cloze Test',
    'Fill in the blanks',
    'Error Detection',
    'Para Jumbles',
    'Data Interpretation',
    'Syllogism',
    'Statement based MCQ',
    'Assertion Reason',
    'Mathematical Word Problems',
  ],
};

const sanitizeText = (value) => String(value || '').trim();

const normalizeTopic = (value) =>
  sanitizeText(value)
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');

const alignGovTopics = ({ examSlug, stageSlug, topics = [] }) => {
  const key = `${sanitizeText(examSlug).toLowerCase()}:${sanitizeText(stageSlug).toLowerCase()}`;
  const catalog = REAL_EXAM_TOPICS[key];
  if (!Array.isArray(catalog) || catalog.length === 0) return topics;

  const cleanTopics = Array.isArray(topics)
    ? topics.map((topic) => sanitizeText(topic)).filter(Boolean)
    : [];
  const normalizedCatalog = catalog.map(normalizeTopic);
  const matched = cleanTopics.filter((topic) => normalizedCatalog.includes(normalizeTopic(topic)));
  const extras = cleanTopics.filter((topic) => !normalizedCatalog.includes(normalizeTopic(topic)));

  const targetSize = Math.max(cleanTopics.length || 0, 10);
  const realCount = Math.max(1, Math.min(targetSize, Math.round(targetSize * 0.9)));
  const extraCount = Math.max(0, targetSize - realCount);

  const selectedReal = Array.from(new Set([...matched, ...catalog])).slice(0, realCount);
  const selectedExtras = Array.from(new Set(extras)).slice(0, extraCount);
  return [...selectedReal, ...selectedExtras];
};

const buildQuestionTypeTargetMixLine = (questionStyles = [], totalQuestions = 0) => {
  const styles = Array.isArray(questionStyles)
    ? questionStyles.map((item) => sanitizeText(item)).filter(Boolean)
    : [];
  if (styles.length === 0) return '';
  const total = Math.max(1, Number(totalQuestions || 0));
  const base = Math.floor(total / styles.length);
  let rem = total % styles.length;
  const parts = styles.map((style) => {
    const count = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    return `${style}:${count}`;
  });
  return `Question-type target mix: ${parts.join(' | ')}.`;
};

const toResponseJob = (job) => {
  const generated = Number(job?.generatedCount || 0);
  const total = Number(job?.totalQuestions || 0);
  const progress = total > 0 ? Math.min(100, Math.round((generated / total) * 100)) : 0;

  return {
    id: String(job?._id || ''),
    owner: String(job?.owner || ''),
    provider: job?.provider || 'gemini',
    status: job?.status || STATUS.QUEUED,
    totalQuestions: total,
    batchSize: Number(job?.batchSize || 0),
    maxRetries: Number(job?.maxRetries || 0),
    retryCount: Number(job?.retryCount || 0),
    generatedCount: generated,
    insertedCount: Number(job?.insertedCount || 0),
    processedBatches: Number(job?.processedBatches || 0),
    failedBatches: Number(job?.failedBatches || 0),
    progress,
    payload: job?.payload || {},
    lastError: sanitizeText(job?.lastError),
    startedAt: job?.startedAt || null,
    lastRunAt: job?.lastRunAt || null,
    finishedAt: job?.finishedAt || null,
    createdAt: job?.createdAt || null,
    updatedAt: job?.updatedAt || null,
  };
};

const createJob = async (ownerId, payload) => {
  const job = await AiGenerationJob.create({
    owner: ownerId,
    provider: payload.provider || 'gemini',
    payload: payload.payload,
    totalQuestions: payload.totalQuestions,
    batchSize: payload.batchSize,
    maxRetries: payload.maxRetries,
    status: STATUS.QUEUED,
    nextRunAt: new Date(),
  });
  return toResponseJob(job);
};

const listJobs = async (ownerId, filters = {}) => {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const query = { owner: ownerId };

  if (filters.status && Object.values(STATUS).includes(filters.status)) {
    query.status = filters.status;
  }

  const [jobs, total] = await Promise.all([
    AiGenerationJob.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AiGenerationJob.countDocuments(query),
  ]);

  return {
    page,
    limit,
    total,
    items: jobs.map(toResponseJob),
  };
};

const getJobById = async (ownerId, jobId) => {
  const job = await AiGenerationJob.findOne({ _id: jobId, owner: ownerId });
  if (!job) {
    throw new ApiError(404, 'AI generation job not found');
  }

  const outputs = await AiGenerationOutput.find({ jobId: job._id })
    .sort({ batchNumber: 1 })
    .limit(50)
    .lean();

  return {
    ...toResponseJob(job),
    recentOutputs: outputs.map((item) => ({
      id: String(item._id),
      batchNumber: item.batchNumber,
      status: item.status,
      requestedCount: item.requestedCount,
      generatedCount: item.generatedCount,
      insertedOrUpdatedCount: item.insertedOrUpdatedCount,
      provider: item.provider,
      error: item.error,
      createdAt: item.createdAt,
    })),
  };
};

const buildWorkerId = () => `worker-${crypto.randomBytes(6).toString('hex')}`;

const upsertBatchOutput = async ({
  jobId,
  ownerId,
  batchNumber,
  status,
  requestedCount,
  generatedCount,
  insertedOrUpdatedCount,
  provider,
  error = '',
}) => {
  await AiGenerationOutput.findOneAndUpdate(
    { jobId, batchNumber },
    {
      $set: {
        owner: ownerId,
        status,
        requestedCount,
        generatedCount,
        insertedOrUpdatedCount,
        provider,
        error: sanitizeText(error),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const claimNextJob = async (ownerId, explicitJobId = '') => {
  const now = new Date();
  const baseFilter = {
    owner: ownerId,
    status: STATUS.QUEUED,
    nextRunAt: { $lte: now },
  };
  const filter = explicitJobId ? { ...baseFilter, _id: explicitJobId } : baseFilter;
  const workerId = buildWorkerId();

  return AiGenerationJob.findOneAndUpdate(
    filter,
    {
      $set: {
        status: STATUS.RUNNING,
        lockedAt: now,
        workerId,
        lastRunAt: now,
      },
      $setOnInsert: {
        startedAt: now,
      },
    },
    {
      new: true,
      sort: explicitJobId ? undefined : { createdAt: 1 },
    }
  );
};

const releaseAsQueued = async (jobId, update = {}) => {
  const now = new Date();
  await AiGenerationJob.findByIdAndUpdate(jobId, {
    $set: {
      status: STATUS.QUEUED,
      nextRunAt: now,
      lockedAt: null,
      workerId: '',
      lastRunAt: now,
      ...update,
    },
  });
};

const markFailed = async (jobId, errorMessage, retryCount, maxRetries) => {
  const now = new Date();
  const nextRetryCount = Number(retryCount || 0) + 1;
  const shouldFail = nextRetryCount > Number(maxRetries || 0);

  await AiGenerationJob.findByIdAndUpdate(jobId, {
    $set: {
      status: shouldFail ? STATUS.FAILED : STATUS.QUEUED,
      nextRunAt: now,
      lastError: sanitizeText(errorMessage),
      lockedAt: null,
      workerId: '',
      lastRunAt: now,
      ...(shouldFail ? { finishedAt: now } : {}),
    },
    $inc: {
      retryCount: 1,
      failedBatches: 1,
    },
  });
};

const processJob = async (ownerId, explicitJobId = '') => {
  const job = await claimNextJob(ownerId, explicitJobId);
  if (!job) {
    return {
      processed: false,
      message: explicitJobId
        ? 'Job is not available to process (it may already be completed/running).'
        : 'No queued jobs available.',
    };
  }

  const remaining = Math.max(0, Number(job.totalQuestions || 0) - Number(job.generatedCount || 0));
  if (remaining <= 0) {
    await AiGenerationJob.findByIdAndUpdate(job._id, {
      $set: {
        status: STATUS.COMPLETED,
        finishedAt: new Date(),
        lockedAt: null,
        workerId: '',
        nextRunAt: new Date(),
      },
    });

    return {
      processed: true,
      job: await getJobById(ownerId, job._id),
      batch: null,
    };
  }

  const requestedCount = Math.min(Number(job.batchSize || 50), remaining);
  const batchNumber = Number(job.processedBatches || 0) + 1;

  try {
    const alignedTopics = alignGovTopics({
      examSlug: job.payload?.examSlug,
      stageSlug: job.payload?.stageSlug,
      topics: job.payload?.topics,
    });

    const curationPayload = {
      ...job.payload,
      topics: alignedTopics,
      questionCount: requestedCount,
      totalTargetQuestions: Number(job.totalQuestions || requestedCount),
      promptContext: [
        sanitizeText(job.payload?.promptContext || ''),
        buildQuestionTypeTargetMixLine(
          Array.isArray(job.payload?.questionStyles) ? job.payload.questionStyles : [],
          Number(job.totalQuestions || requestedCount)
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
    };

    const curated = await aiCurationService.curateQuestions({
      payload: curationPayload,
      provider: job.provider,
    });

    const questions = Array.isArray(curated?.questions) ? curated.questions : [];
    const ingestResult = await questionBankService.ingestQuestions({
      ownerId,
      sourceAttemptId: null,
      payload: curationPayload,
      provider: job.provider,
      questions,
    });

    await upsertBatchOutput({
      jobId: job._id,
      ownerId,
      batchNumber,
      status: 'success',
      requestedCount,
      generatedCount: questions.length,
      insertedOrUpdatedCount: Number(ingestResult?.insertedOrUpdated || 0),
      provider: job.provider,
      error: '',
    });

    const nextGenerated = Number(job.generatedCount || 0) + questions.length;
    const isCompleted = nextGenerated >= Number(job.totalQuestions || 0);
    const now = new Date();

    await AiGenerationJob.findByIdAndUpdate(job._id, {
      $set: {
        status: isCompleted ? STATUS.COMPLETED : STATUS.QUEUED,
        nextRunAt: now,
        lockedAt: null,
        workerId: '',
        lastRunAt: now,
        lastError: '',
        ...(job.startedAt ? {} : { startedAt: now }),
        ...(isCompleted ? { finishedAt: now } : {}),
      },
      $inc: {
        generatedCount: questions.length,
        insertedCount: Number(ingestResult?.insertedOrUpdated || 0),
        processedBatches: 1,
      },
    });

    return {
      processed: true,
      batch: {
        batchNumber,
        requestedCount,
        generatedCount: questions.length,
        insertedOrUpdatedCount: Number(ingestResult?.insertedOrUpdated || 0),
        status: 'success',
      },
      job: await getJobById(ownerId, job._id),
    };
  } catch (error) {
    const errorMessage = sanitizeText(error?.message || 'Unknown batch processing error');

    await upsertBatchOutput({
      jobId: job._id,
      ownerId,
      batchNumber,
      status: 'failed',
      requestedCount,
      generatedCount: 0,
      insertedOrUpdatedCount: 0,
      provider: job.provider,
      error: errorMessage,
    });

    await markFailed(job._id, errorMessage, job.retryCount, job.maxRetries);

    if (Number(job.retryCount || 0) + 1 <= Number(job.maxRetries || 0)) {
      await releaseAsQueued(job._id, { lastError: errorMessage });
    }

    return {
      processed: true,
      batch: {
        batchNumber,
        requestedCount,
        generatedCount: 0,
        insertedOrUpdatedCount: 0,
        status: 'failed',
        error: errorMessage,
      },
      job: await getJobById(ownerId, job._id),
    };
  }
};

module.exports = {
  createJob,
  listJobs,
  getJobById,
  processJob,
};
