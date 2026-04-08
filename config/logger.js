const winston = require('winston');
const isProd = process.env.NODE_ENV === 'production';
const SERVICE_NAME = 'aiguru-api';

// In-memory log store for logs page
const LOG_STORE_MAX = 1000;
const LOG_STORE_TTL = 15 * 60 * 1000; // 15 mins

class LogStore {
  constructor() {
    this.logs = [];
  }

  add(level, source, message, data = null, metadata = {}) {
    const log = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      level,
      source,
      message,
      data,
      ...metadata
    };

    this.logs.unshift(log);
    if (this.logs.length > LOG_STORE_MAX) {
      this.logs = this.logs.slice(0, LOG_STORE_MAX);
    }

    return log;
  }

  cleanup() {
    const cutoff = Date.now() - LOG_STORE_TTL;
    this.logs = this.logs.filter(log => log.timestamp > cutoff);
  }

  query(filters = {}) {
    let result = [...this.logs];

    if (filters.level && filters.level !== 'all') {
      result = result.filter(log => log.level === filters.level);
    }

    if (filters.source && filters.source !== 'all') {
      result = result.filter(log => log.source === filters.source);
    }

    if (filters.since) {
      const sinceMs = Date.now() - (filters.since * 60 * 1000);
      result = result.filter(log => log.timestamp >= sinceMs);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
      );
    }

    const page = parseInt(filters.page) || 1;
    const limit = Math.min(parseInt(filters.limit) || 100, 500);
    const start = (page - 1) * limit;

    return {
      logs: result.slice(start, start + limit),
      total: result.length,
      page,
      limit
    };
  }

  clear() {
    const count = this.logs.length;
    this.logs = [];
    return { cleared: count };
  }

  stats() {
    const now = Date.now();
    const recentCutoff = now - LOG_STORE_TTL;
    const stats = {
      total: this.logs.length,
      byLevel: { error: 0, warn: 0, info: 0, debug: 0 },
      bySource: {},
      recentCount: 0
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.bySource[log.source] = (stats.bySource[log.source] || 0) + 1;
      if (log.timestamp > recentCutoff) stats.recentCount++;
    });

    return stats;
  }
}

const logStore = new LogStore();

// Cleanup every minute
setInterval(() => logStore.cleanup(), 60000);
logStore.cleanup();

// Custom winston transport to store logs in logStore
const logStoreTransport = {
  log(info, callback) {
    setImmediate(() => {
      try {
        const { level, message, ...meta } = info;
        const source = meta.source || 'system';
        const parsedLevel = level === 'warn' ? 'warn' : level === 'error' ? 'error' : level === 'debug' ? 'debug' : 'info';
        
        // Skip if already stored by httpLogger
        if (meta.requestId) return callback();
        
        logStore.add(parsedLevel, source, message, null, meta);
      } catch (err) {
        console.error('logStoreTransport error:', err);
      }
    });
    callback();
  }
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    isProd
      ? winston.format.json()
      : winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
          return `${timestamp} [${level.toUpperCase()}] ${message}${metaString}`;
        })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

const httpLogger = (req, res, next) => {
  const start = Date.now();
  const requestId =
    req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  res.on('finish', () => {
    // Skip logging for internal endpoints
    const skipUrls = ['/api/v1/admin/logs', '/api/v1/auth/me', '/api/v1/analytics/track'];
    if (skipUrls.some(url => req.originalUrl.startsWith(url))) return;

    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    const logData = {
      service: SERVICE_NAME,
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length') || 0,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
    };

    // Store in logStore
    logStore.add(level, 'api', `${req.method} ${req.originalUrl}`, null, logData);

    // Also log to winston
    logger[level](JSON.stringify(logData, null, 2));
  });

  res.on('error', (err) => {
    const logData = {
      service: SERVICE_NAME,
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      stack: err.stack,
      statusCode: res.statusCode,
    };

    logStore.add('error', 'api', `${req.method} ${req.originalUrl}`, null, logData);
    logger.error(JSON.stringify(logData, null, 2));
  });

  next();
};

// Export logger functions for manual logging
const logInfo = (source, message, data) => logStore.add('info', source, message, data);
const logWarn = (source, message, data) => logStore.add('warn', source, message, data);
const logError = (source, message, data) => logStore.add('error', source, message, data);

module.exports = {
  logger,
  httpLogger,
  logStore,
  logInfo,
  logWarn,
  logError
};
