const AnalyticsEvent = require('../models/analyticsEvent');
const UserJourney = require('../models/userJourney');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const sanitizePath = (value) => String(value || '').trim() || '/';
const sanitizeSlug = (value) => String(value || '').trim();

const safeNumber = (val, fallback = 0) => (typeof val === 'number' && !isNaN(val) ? val : fallback);
const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

const trackEvent = async (payload, user) => {
  const eventData = {
    eventType: payload.eventType,
    visitorId: payload.visitorId,
    sessionId: payload.sessionId || null,
    path: sanitizePath(payload.path),
    examSlug: payload.examSlug ? sanitizeSlug(payload.examSlug) : null,
    categorySlug: payload.categorySlug ? sanitizeSlug(payload.categorySlug) : null,
    categoryName: payload.categoryName || null,
    metadata: payload.metadata || {},
    deviceType: payload.deviceType || 'unknown',
    referrer: payload.referrer || null,
    userAgent: payload.userAgent || null,
    language: payload.language || 'en',
  };

  if (user?.id) {
    eventData.userId = user.id;
  }

  return AnalyticsEvent.create(eventData);
};

const getCategoryPerformance = async ({ days, limit = DEFAULT_LIMIT }) => {
  const now = new Date();
  const from = new Date(now.getTime() - (days || 7) * 24 * 60 * 60 * 1000);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit || DEFAULT_LIMIT));

  const result = await AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: from }, categorySlug: { $exists: true, $ne: null, $ne: '' } } },
    { $limit: 50000 },
    {
      $group: {
        _id: '$categorySlug',
        categoryName: { $first: '$categoryName' },
        views: { $sum: 1 },
        wishlistAdds: { $sum: { $cond: [{ $eq: ['$eventType', 'wishlist_add'] }, 1, 0] } },
        shares: { $sum: { $cond: [{ $eq: ['$eventType', 'share'] }, 1, 0] } },
        downloads: { $sum: { $cond: [{ $eq: ['$eventType', 'download'] }, 1, 0] } },
        examStarts: { $sum: { $cond: [{ $eq: ['$eventType', 'exam_start'] }, 1, 0] } },
        examCompletes: { $sum: { $cond: [{ $eq: ['$eventType', 'exam_complete'] }, 1, 0] } },
        uniqueVisitors: { $addToSet: '$visitorId' },
      },
    },
    {
      $project: {
        categorySlug: '$_id',
        categoryName: 1,
        views: 1,
        wishlistAdds: 1,
        shares: 1,
        downloads: 1,
        examStarts: 1,
        examCompletes: 1,
        uniqueVisitors: { $size: { $ifNull: ['$uniqueVisitors', []] } },
        conversionRate: {
          $cond: [{ $gt: ['$views', 0] }, { $multiply: [{ $divide: [{ $ifNull: ['$examStarts', 0] }, '$views'] }, 100] }, 0],
        },
      },
    },
    { $sort: { views: -1 } },
    { $limit: safeLimit },
  ], { allowDiskUse: true });

  const totalViews = result.reduce((sum, c) => sum + safeNumber(c.views), 0);

  return {
    period: { from, to: now, days },
    categories: result.map((c) => ({
      ...c,
      views: safeNumber(c.views),
      wishlistAdds: safeNumber(c.wishlistAdds),
      shares: safeNumber(c.shares),
      downloads: safeNumber(c.downloads),
      examStarts: safeNumber(c.examStarts),
      examCompletes: safeNumber(c.examCompletes),
      uniqueVisitors: safeNumber(c.uniqueVisitors),
      conversionRate: Math.round(safeNumber(c.conversionRate)),
      share: totalViews > 0 ? Math.round((safeNumber(c.views) / totalViews) * 100) : 0,
    })),
  };
};

const getContentPerformance = async ({ days, limit = DEFAULT_LIMIT }) => {
  const now = new Date();
  const from = new Date(now.getTime() - (days || 7) * 24 * 60 * 60 * 1000);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit || DEFAULT_LIMIT));

  const [examStats, wishlistStats, shareStats, searchStats] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from }, examSlug: { $exists: true, $ne: null, $ne: '' } } },
      { $limit: 50000 },
      {
        $group: {
          _id: '$examSlug',
          categorySlug: { $first: '$categorySlug' },
          views: { $sum: 1 },
          wishlistAdds: { $sum: { $cond: [{ $eq: ['$eventType', 'wishlist_add'] }, 1, 0] } },
          shares: { $sum: { $cond: [{ $eq: ['$eventType', 'share'] }, 1, 0] } },
          examStarts: { $sum: { $cond: [{ $eq: ['$eventType', 'exam_start'] }, 1, 0] } },
          examCompletes: { $sum: { $cond: [{ $eq: ['$eventType', 'exam_complete'] }, 1, 0] } },
          uniqueVisitors: { $addToSet: '$visitorId' },
          engagementScore: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ['$eventType', 'wishlist_add'] }, then: 5 },
                  { case: { $eq: ['$eventType', 'share'] }, then: 3 },
                  { case: { $eq: ['$eventType', 'exam_start'] }, then: 10 },
                  { case: { $eq: ['$eventType', 'exam_complete'] }, then: 15 },
                ],
                default: 1,
              },
            },
          },
        },
      },
      { $project: { examSlug: '$_id', categorySlug: 1, views: 1, wishlistAdds: 1, shares: 1, examStarts: 1, examCompletes: 1, uniqueVisitors: { $size: { $ifNull: ['$uniqueVisitors', []] } }, engagementScore: 1 } },
      { $sort: { views: -1 } },
      { $limit: safeLimit },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from }, eventType: 'wishlist_add', examSlug: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$examSlug', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: safeLimit },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from }, eventType: 'share', examSlug: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$examSlug', count: { $sum: 1 }, methods: { $addToSet: '$metadata.method' } } },
      { $sort: { count: -1 } },
      { $limit: safeLimit },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from }, eventType: 'search', 'metadata.searchTerm': { $exists: true, $ne: '' } } },
      { $group: { _id: '$metadata.searchTerm', count: { $sum: 1 }, noResults: { $sum: { $cond: ['$metadata.noResults', 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: safeLimit },
    ], { allowDiskUse: true }),
  ]);

  return {
    period: { from, to: now, days },
    topExams: examStats.map((e) => ({
      ...e,
      views: safeNumber(e.views),
      wishlistAdds: safeNumber(e.wishlistAdds),
      shares: safeNumber(e.shares),
      examStarts: safeNumber(e.examStarts),
      examCompletes: safeNumber(e.examCompletes),
      uniqueVisitors: safeNumber(e.uniqueVisitors),
      engagementScore: safeNumber(e.engagementScore),
      conversionRate: Math.round(safeNumber(e.views) > 0 ? (safeNumber(e.examStarts) / safeNumber(e.views)) * 100 : 0),
    })),
    topWishlisted: wishlistStats.map((w) => ({ examSlug: w._id, count: safeNumber(w.count) })),
    topShared: shareStats.map((s) => ({ examSlug: s._id, count: safeNumber(s.count), methods: safeArray(s.methods) })),
    searchTerms: searchStats.map((s) => ({ term: s._id, count: safeNumber(s.count), noResults: safeNumber(s.noResults) })),
  };
};

const getUserJourneys = async ({ days }) => {
  const now = new Date();
  const from = new Date(now.getTime() - (days || 7) * 24 * 60 * 60 * 1000);

  const [summary, entryPoints, exitPoints] = await Promise.all([
    UserJourney.aggregate([
      { $match: { startedAt: { $gte: from } } },
      { $limit: 50000 },
      {
        $group: {
          _id: null,
          totalJourneys: { $sum: 1 },
          avgPages: { $avg: { $ifNull: ['$pageCount', 1] } },
          avgDuration: { $avg: { $ifNull: ['$totalDuration', 0] } },
          uniqueVisitors: { $addToSet: '$visitorId' },
          bounces: { $sum: { $cond: [{ $lte: [{ $ifNull: ['$pageCount', 1] }, 1] }, 1, 0] } },
        },
      },
    ], { allowDiskUse: true }),

    UserJourney.aggregate([
      { $match: { startedAt: { $gte: from }, 'pathSequence.0': { $exists: true } } },
      { $limit: 50000 },
      { $group: { _id: { $arrayElemAt: ['$pathSequence.path', 0] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ], { allowDiskUse: true }),

    UserJourney.aggregate([
      { $match: { startedAt: { $gte: from }, exitPage: { $exists: true, $ne: null, $ne: '' } } },
      { $limit: 50000 },
      { $group: { _id: '$exitPage', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ], { allowDiskUse: true }),
  ]);

  const stats = summary[0] || {};
  const totalJourneys = safeNumber(stats.totalJourneys);

  return {
    period: { from, to: now, days },
    summary: {
      totalJourneys,
      avgPagesPerJourney: Math.round(safeNumber(stats.avgPages) * 10) / 10,
      avgDurationSec: Math.round(safeNumber(stats.avgDuration) / 1000),
      uniqueVisitors: safeArray(stats.uniqueVisitors).length,
      bounceRate: totalJourneys > 0 ? Math.round((safeNumber(stats.bounces) / totalJourneys) * 100) : 0,
    },
    entryPoints: entryPoints.map((e) => ({ path: e._id, count: safeNumber(e.count) })),
    exitPoints: exitPoints.map((e) => ({ path: e._id, count: safeNumber(e.count) })),
  };
};

const getFunnelAnalytics = async ({ days }) => {
  const now = new Date();
  const from = new Date(now.getTime() - (days || 7) * 24 * 60 * 60 * 1000);

  const steps = [
    { step: 'view', name: 'Page View', eventType: { $in: ['category_view', 'exam_view'] } },
    { step: 'wishlist', name: 'Add Wishlist', eventType: 'wishlist_add' },
    { step: 'start', name: 'Start Exam', eventType: 'exam_start' },
    { step: 'complete', name: 'Complete Exam', eventType: 'exam_complete' },
  ];

  const funnelResult = await Promise.all(
    steps.map(async (step) => {
      const count = await AnalyticsEvent.countDocuments({
        createdAt: { $gte: from },
        eventType: step.eventType,
      });
      return { step: step.step, name: step.name, count };
    })
  );

  const totalUsers = await AnalyticsEvent.distinct('visitorId', { createdAt: { $gte: from } });

  const funnel = funnelResult.map((step, i) => {
    const prev = i > 0 ? funnelResult[i - 1].count : safeNumber(totalUsers.length);
    const curr = safeNumber(step.count);
    return {
      ...step,
      count: curr,
      conversionRate: prev > 0 ? Math.round((curr / prev) * 100) : 0,
      dropoffRate: prev > 0 ? Math.round(((prev - curr) / prev) * 100) : 0,
    };
  });

  const firstStep = funnel[0]?.count || 1;
  const lastStep = funnel[funnel.length - 1]?.count || 0;

  return {
    period: { from, to: now, days },
    summary: {
      totalUsers: safeNumber(totalUsers.length),
      funnelSteps: steps.length,
      overallConversion: firstStep > 0 ? Math.round((lastStep / firstStep) * 100) : 0,
    },
    funnel,
  };
};

const getRealTimeEngagement = async () => {
  const now = new Date();
  const activeWindow = new Date(now.getTime() - 5 * 60 * 1000);

  const [eventsByType, topExam, topCategory] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: activeWindow } } },
      { $group: { _id: '$eventType', count: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $sort: { count: -1 } },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: activeWindow }, examSlug: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$examSlug', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: activeWindow }, categorySlug: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$categorySlug', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ], { allowDiskUse: true }),
  ]);

  const allVisitors = eventsByType.flatMap((e) => safeArray(e.visitors));
  const uniqueVisitors = [...new Set(allVisitors)];

  return {
    timestamp: now,
    windowMinutes: 5,
    activeUsers: uniqueVisitors.length,
    eventsByType: eventsByType.map((e) => ({ eventType: e._id, count: safeNumber(e.count) })),
    topExam: topExam.map((e) => ({ examSlug: e._id, count: safeNumber(e.count) })),
    topCategory: topCategory.map((e) => ({ categorySlug: e._id, count: safeNumber(e.count) })),
  };
};

const getAudienceInsights = async ({ days }) => {
  const now = new Date();
  const from = new Date(now.getTime() - (days || 7) * 24 * 60 * 60 * 1000);

  const [byDevice, byLanguage, userCounts] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$deviceType', events: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $sort: { events: -1 } },
      { $limit: 10 },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from }, language: { $exists: true, $ne: null } } },
      { $group: { _id: '$language', events: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $sort: { events: -1 } },
      { $limit: 10 },
    ], { allowDiskUse: true }),

    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: null, total: { $sum: 1 }, authenticated: { $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] } } } },
    ], { allowDiskUse: true }),
  ]);

  const counts = userCounts[0] || { total: 0, authenticated: 0 };

  return {
    period: { from, to: now, days },
    summary: {
      totalEvents: safeNumber(counts.total),
      authenticatedRate: safeNumber(counts.total) > 0 ? Math.round((safeNumber(counts.authenticated) / safeNumber(counts.total)) * 100) : 0,
    },
    byDevice: byDevice.map((d) => ({
      device: d._id || 'unknown',
      events: safeNumber(d.events),
      uniqueUsers: safeArray(d.visitors).length,
    })),
    byLanguage: byLanguage.map((l) => ({
      language: l._id || 'unknown',
      events: safeNumber(l.events),
      uniqueUsers: safeArray(l.visitors).length,
    })),
  };
};

module.exports = {
  trackEvent,
  getCategoryPerformance,
  getContentPerformance,
  getUserJourneys,
  getFunnelAnalytics,
  getRealTimeEngagement,
  getAudienceInsights,
};
