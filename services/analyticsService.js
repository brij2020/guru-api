const UserAnalyticsSession = require('../models/userAnalyticsSession');

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const sanitizePath = (value) => {
  const raw = String(value || '').trim();
  return raw || '/';
};

const normalizeString = (value) => String(value || '').trim();

const trackSessionStart = async (payload, user) => {
  const now = new Date();
  const update = {
    visitorId: payload.visitorId,
    path: sanitizePath(payload.path),
    pageTitle: normalizeString(payload.pageTitle),
    pageType: normalizeString(payload.pageType) || 'page',
    lang: normalizeString(payload.lang) || 'en',
    examSlug: normalizeString(payload.examSlug),
    categoryKey: normalizeString(payload.categoryKey),
    testId: normalizeString(payload.testId),
    referrer: normalizeString(payload.referrer),
    userAgent: normalizeString(payload.userAgent),
    deviceType: normalizeString(payload.deviceType) || 'unknown',
    lastSeenAt: now,
    isActive: true,
  };

  if (user?.id) {
    update.owner = user.id;
  }

  return UserAnalyticsSession.findOneAndUpdate(
    { sessionId: payload.sessionId },
    {
      $set: update,
      $setOnInsert: {
        sessionId: payload.sessionId,
        startedAt: now,
        activeTimeMs: 0,
        clickCount: 0,
        interactionCount: 0,
        maxScrollPercent: 0,
      },
    },
    { upsert: true, new: true }
  );
};

const trackSessionHeartbeat = async (payload) => {
  const now = new Date();
  const session = await UserAnalyticsSession.findOne({ sessionId: payload.sessionId });
  if (!session) {
    return null;
  }

  session.lastSeenAt = now;
  session.isActive = true;
  session.activeTimeMs += Number(payload.activeTimeMsDelta || 0);
  session.clickCount += Number(payload.clickCountDelta || 0);
  session.interactionCount += Number(payload.interactionCountDelta || 0);
  session.maxScrollPercent = Math.max(
    Number(session.maxScrollPercent || 0),
    Number(payload.maxScrollPercent || 0)
  );

  if (payload.pageTitle !== undefined) session.pageTitle = normalizeString(payload.pageTitle);
  if (payload.pageType !== undefined) session.pageType = normalizeString(payload.pageType) || session.pageType;
  if (payload.examSlug !== undefined) session.examSlug = normalizeString(payload.examSlug);
  if (payload.categoryKey !== undefined) session.categoryKey = normalizeString(payload.categoryKey);
  if (payload.testId !== undefined) session.testId = normalizeString(payload.testId);
  if (payload.path !== undefined) session.path = sanitizePath(payload.path);

  await session.save();
  return session;
};

const trackSessionEnd = async (payload) => {
  const session = await trackSessionHeartbeat(payload);
  if (!session) {
    return null;
  }

  session.isActive = false;
  session.endedAt = new Date();
  await session.save();
  return session;
};

const getOverview = async ({ days }) => {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const result = await UserAnalyticsSession.aggregate([
    { $match: { startedAt: { $gte: from } } },
    {
      $facet: {
        totalStats: [
          {
            $group: {
              _id: null,
              pageViews: { $sum: 1 },
              totalActiveTime: { $sum: '$activeTimeMs' },
              totalClicks: { $sum: '$clickCount' },
              totalInteractions: { $sum: '$interactionCount' },
              uniqueVisitors: { $addToSet: '$visitorId' },
              loggedInUsers: { $addToSet: '$owner' },
            },
          },
        ],
        dailyStats: [
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$startedAt' },
              },
              pageViews: { $sum: 1 },
              uniqueVisitors: { $addToSet: '$visitorId' },
              loggedInUsers: { $addToSet: '$owner' },
            },
          },
          { $sort: { _id: 1 } },
        ],
        hourlyStats: [
          {
            $group: {
              _id: {
                hour: { $hour: '$startedAt' },
                day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
              },
              pageViews: { $sum: 1 },
            },
          },
          { $sort: { '_id.day': 1, '_id.hour': 1 } },
        ],
        deviceBreakdown: [
          {
            $group: {
              _id: '$deviceType',
              sessions: { $sum: 1 },
              avgActiveTime: { $avg: '$activeTimeMs' },
            },
          },
          { $sort: { sessions: -1 } },
        ],
      },
    },
  ]);

  const stats = result[0]?.totalStats?.[0] || {};
  const pageViews = stats.pageViews || 0;
  const totalActiveTime = stats.totalActiveTime || 0;

  return {
    period: { from, to: now, days },
    summary: {
      pageViews,
      uniqueVisitors: (stats.uniqueVisitors || []).length,
      loggedInUsers: (stats.loggedInUsers || []).filter(Boolean).length,
      avgSessionDurationSec: pageViews > 0 ? Math.round(totalActiveTime / pageViews / 1000) : 0,
      avgTimeOnPageSec: pageViews > 0 ? Math.round(totalActiveTime / pageViews / 1000) : 0,
      totalClicks: stats.totalClicks || 0,
      totalInteractions: stats.totalInteractions || 0,
      avgClicksPerSession: pageViews > 0 ? Math.round((stats.totalClicks || 0) / pageViews * 10) / 10 : 0,
    },
    dailyTrend: (result[0]?.dailyStats || []).map((d) => ({
      date: d._id,
      pageViews: d.pageViews,
      uniqueVisitors: (d.uniqueVisitors || []).length,
      loggedInUsers: (d.loggedInUsers || []).filter(Boolean).length,
    })),
    hourlyPattern: (result[0]?.hourlyStats || []).reduce((acc, h) => {
      const existing = acc.find((x) => x.hour === h._id.hour);
      if (existing) {
        existing.pageViews += h.pageViews;
        existing.days++;
      } else {
        acc.push({ hour: h._id.hour, pageViews: h.pageViews, days: 1 });
      }
      return acc;
    }, []).map((h) => ({
      hour: h.hour,
      avgPageViews: Math.round(h.pageViews / h.days),
    })).sort((a, b) => a.hour - b.hour),
    devices: (result[0]?.deviceBreakdown || []).map((d) => ({
      device: d._id || 'unknown',
      sessions: d.sessions,
      avgSessionDurationSec: Math.round(d.avgActiveTime / 1000),
      percentage: Math.round(d.sessions / pageViews * 100) || 0,
    })),
  };
};

const getPageAnalytics = async ({ days, path }) => {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const matchStage = {
    startedAt: { $gte: from },
    ...(path ? { path: sanitizePath(path) } : {}),
  };

  const result = await UserAnalyticsSession.aggregate([
    { $match: matchStage },
    {
      $facet: {
        byPage: [
          {
            $group: {
              _id: '$path',
              pageViews: { $sum: 1 },
              uniqueVisitors: { $addToSet: '$visitorId' },
              totalActiveTime: { $sum: '$activeTimeMs' },
              totalClicks: { $sum: '$clickCount' },
              avgScrollPercent: { $avg: '$maxScrollPercent' },
              avgInteractions: { $avg: '$interactionCount' },
              sessions: { $sum: 1 },
            },
          },
          { $sort: { pageViews: -1 } },
          { $limit: 50 },
        ],
        byPageType: [
          {
            $group: {
              _id: '$pageType',
              pageViews: { $sum: 1 },
              uniqueVisitors: { $addToSet: '$visitorId' },
              totalActiveTime: { $sum: '$activeTimeMs' },
              avgScrollPercent: { $avg: '$maxScrollPercent' },
            },
          },
          { $sort: { pageViews: -1 } },
        ],
      },
    },
  ]);

  const byPage = result[0]?.byPage || [];
  const totalViews = byPage.reduce((sum, p) => sum + p.pageViews, 0);

  return {
    period: { from, to: now, days },
    topPages: byPage.map((p) => ({
      path: p._id,
      pageViews: p.pageViews,
      uniqueVisitors: (p.uniqueVisitors || []).length,
      avgTimeOnPageSec: Math.round(p.totalActiveTime / p.pageViews / 1000) || 0,
      avgScrollPercent: Math.round(p.avgScrollPercent) || 0,
      avgClicksPerSession: Math.round(p.totalClicks / p.pageViews * 10) / 10 || 0,
      bounceRate: Math.round((1 - p.sessions / p.pageViews) * 100) || 0,
      engagementRate: Math.round((p.avgScrollPercent / 100) * 100) || 0,
      share: Math.round(p.pageViews / totalViews * 100) || 0,
    })),
    byPageType: (result[0]?.byPageType || []).map((p) => ({
      pageType: p._id || 'unknown',
      pageViews: p.pageViews,
      uniqueVisitors: (p.uniqueVisitors || []).length,
      avgTimeOnPageSec: Math.round(p.totalActiveTime / p.pageViews / 1000) || 0,
      avgScrollPercent: Math.round(p.avgScrollPercent) || 0,
    })),
  };
};

const getExamAnalytics = async ({ days }) => {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const result = await UserAnalyticsSession.aggregate([
    {
      $match: {
        startedAt: { $gte: from },
        examSlug: { $exists: true, $ne: '' },
      },
    },
    {
      $facet: {
        byExam: [
          {
            $group: {
              _id: '$examSlug',
              pageViews: { $sum: 1 },
              uniqueVisitors: { $addToSet: '$visitorId' },
              totalActiveTime: { $sum: '$activeTimeMs' },
              totalClicks: { $sum: '$clickCount' },
              avgScrollPercent: { $avg: '$maxScrollPercent' },
            },
          },
          { $sort: { pageViews: -1 } },
        ],
        byCategory: [
          {
            $match: { categoryKey: { $exists: true, $ne: '' } },
          },
          {
            $group: {
              _id: '$categoryKey',
              pageViews: { $sum: 1 },
              uniqueVisitors: { $addToSet: '$visitorId' },
              totalActiveTime: { $sum: '$activeTimeMs' },
            },
          },
          { $sort: { pageViews: -1 } },
          { $limit: 10 },
        ],
        byStage: [
          {
            $addFields: {
              stage: {
                $arrayElemAt: [
                  { $split: ['$path', '/mock-test-builder/'] },
                  1,
                ],
              },
            },
          },
          {
            $group: {
              _id: '$stage',
              pageViews: { $sum: 1 },
              totalActiveTime: { $sum: '$activeTimeMs' },
            },
          },
          { $sort: { pageViews: -1 } },
        ],
      },
    },
  ]);

  const byExam = result[0]?.byExam || [];
  const totalViews = byExam.reduce((sum, e) => sum + e.pageViews, 0);

  return {
    period: { from, to: now, days },
    topExams: byExam.map((e) => ({
      examSlug: e._id,
      pageViews: e.pageViews,
      uniqueVisitors: (e.uniqueVisitors || []).length,
      avgTimeSec: Math.round(e.totalActiveTime / e.pageViews / 1000) || 0,
      avgScrollPercent: Math.round(e.avgScrollPercent) || 0,
      avgClicks: Math.round(e.totalClicks / e.pageViews * 10) / 10 || 0,
      share: Math.round(e.pageViews / totalViews * 100) || 0,
    })),
    topCategories: (result[0]?.byCategory || []).map((c) => ({
      categoryKey: c._id,
      pageViews: c.pageViews,
      uniqueVisitors: (c.uniqueVisitors || []).length,
      avgTimeSec: Math.round(c.totalActiveTime / c.pageViews / 1000) || 0,
    })),
    byStage: (result[0]?.byStage || []).map((s) => ({
      stage: s._id,
      pageViews: s.pageViews,
      avgTimeSec: Math.round(s.totalActiveTime / s.pageViews / 1000) || 0,
    })),
  };
};

const getUserEngagement = async ({ days }) => {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const result = await UserAnalyticsSession.aggregate([
    { $match: { startedAt: { $gte: from } } },
    {
      $facet: {
        engagementBands: [
          {
            $bucket: {
              groupBy: '$activeTimeMs',
              boundaries: [0, 5000, 15000, 30000, 60000, 120000, 300000, Infinity],
              default: 'Other',
              output: {
                sessions: { $sum: 1 },
                visitors: { $addToSet: '$visitorId' },
              },
            },
          },
        ],
        scrollBands: [
          {
            $bucket: {
              groupBy: '$maxScrollPercent',
              boundaries: [0, 25, 50, 75, 90, 100],
              default: 'Other',
              output: {
                sessions: { $sum: 1 },
              },
            },
          },
        ],
        sessionLengths: [
          {
            $addFields: {
              sessionDuration: {
                $divide: [
                  { $subtract: ['$lastSeenAt', '$startedAt'] },
                  1000,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: '$sessionDuration' },
              minDuration: { $min: '$sessionDuration' },
              maxDuration: { $max: '$sessionDuration' },
            },
          },
        ],
        newVsReturning: [
          {
            $group: {
              _id: {
                $cond: [{ $eq: ['$clickCount', 0] }, 'bounce', 'engaged'],
              },
              sessions: { $sum: 1 },
              visitors: { $addToSet: '$visitorId' },
            },
          },
        ],
      },
    },
  ]);

  const bands = result[0]?.engagementBands || [];
  const totalSessions = bands.reduce((sum, b) => sum + b.sessions, 0);

  return {
    period: { from, to: now, days },
    sessionDuration: {
      labels: ['0-5s', '5-15s', '15-30s', '30-60s', '1-2min', '2-5min', '5min+'],
      data: bands.map((b) => ({
        range: b._id,
        sessions: b.sessions,
        percentage: totalSessions > 0 ? Math.round(b.sessions / totalSessions * 100) : 0,
        uniqueVisitors: (b.visitors || []).length,
      })),
    },
    scrollDepth: {
      labels: ['0-25%', '25-50%', '50-75%', '75-90%', '90-100%'],
      data: (result[0]?.scrollBands || []).map((s) => ({
        range: s._id,
        sessions: s.sessions,
        percentage: totalSessions > 0 ? Math.round(s.sessions / totalSessions * 100) : 0,
      })),
    },
    avgSessionDuration: Math.round((result[0]?.sessionLengths?.[0]?.avgDuration || 0)),
    minSessionDuration: Math.round((result[0]?.sessionLengths?.[0]?.minDuration || 0)),
    maxSessionDuration: Math.round((result[0]?.sessionLengths?.[0]?.maxDuration || 0)),
    bounceRate: Math.round(
      ((result[0]?.newVsReturning?.find((r) => r._id === 'bounce')?.sessions || 0) /
        totalSessions) *
        100
    ) || 0,
    engagementRate: Math.round(
      ((result[0]?.newVsReturning?.find((r) => r._id === 'engaged')?.sessions || 0) /
        totalSessions) *
        100
    ) || 0,
  };
};

const getRealTimeAnalytics = async () => {
  const now = new Date();
  const activeWindow = new Date(now.getTime() - ACTIVE_WINDOW_MS);

  const result = await UserAnalyticsSession.aggregate([
    {
      $match: {
        lastSeenAt: { $gte: activeWindow },
        isActive: true,
      },
    },
    {
      $facet: {
        activeUsers: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              uniqueVisitors: { $addToSet: '$visitorId' },
              byPage: { $push: '$path' },
            },
          },
        ],
        byPage: [
          {
            $group: {
              _id: '$path',
              active: { $sum: 1 },
              visitors: { $addToSet: '$visitorId' },
            },
          },
          { $sort: { active: -1 } },
          { $limit: 10 },
        ],
        byPageType: [
          {
            $group: {
              _id: '$pageType',
              active: { $sum: 1 },
            },
          },
          { $sort: { active: -1 } },
        ],
      },
    },
  ]);

  const active = result[0]?.activeUsers?.[0] || {};

  return {
    timestamp: now,
    activeUsers: {
      total: active.total || 0,
      unique: (active.uniqueVisitors || []).length,
    },
    topPages: (result[0]?.byPage || []).map((p) => ({
      path: p._id,
      activeUsers: p.active,
      uniqueVisitors: (p.visitors || []).length,
    })),
    byPageType: (result[0]?.byPageType || []).map((p) => ({
      pageType: p._id || 'unknown',
      activeUsers: p.active,
    })),
  };
};

const getAnalyticsSummary = async ({ days }) => {
  const [overview, pages, exams, engagement] = await Promise.all([
    getOverview({ days }),
    getPageAnalytics({ days }),
    getExamAnalytics({ days }),
    getUserEngagement({ days }),
  ]);

  return {
    overview,
    pages,
    exams,
    engagement,
  };
};

module.exports = {
  trackSessionStart,
  trackSessionHeartbeat,
  trackSessionEnd,
  getOverview,
  getPageAnalytics,
  getExamAnalytics,
  getUserEngagement,
  getRealTimeAnalytics,
  getAnalyticsSummary,
};
