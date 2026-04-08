class Logger {
  constructor() {
    this.logs = [];
    this.MAX_LOGS = parseInt(process.env.MAX_LOGS) || 1000;
    this.LOG_TTL = parseInt(process.env.LOG_TTL_MS) || 15 * 60 * 1000; // 15 mins
    this.keepaliveTimers = new Set();
  }

  cleanup() {
    const cutoff = Date.now() - this.LOG_TTL;
    const before = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp > cutoff);
    if (this.logs.length < before) {
      console.log(`[Logger] Cleaned up ${before - this.logs.length} old logs`);
    }
  }

  startAutoCleanup(intervalMs = 60000) {
    const timer = setInterval(() => this.cleanup(), intervalMs);
    this.keepaliveTimers.add(timer);
    return timer;
  }

  stopAutoCleanup() {
    this.keepaliveTimers.forEach(timer => clearInterval(timer));
    this.keepaliveTimers.clear();
  }

  _add(level, source, message, data = null, metadata = {}) {
    const log = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      level, // error, warn, info, debug
      source, // backend, api, db, auth
      message: String(message),
      data: data || null,
      ...metadata
    };

    this.logs.unshift(log); // Add to beginning

    // Trim if over max
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // Console output with formatting
    const levelPrefix = {
      error: '\x1b[31m[ERROR]\x1b[0m',
      warn: '\x1b[33m[WARN]\x1b[0m',
      info: '\x1b[36m[INFO]\x1b[0m',
      debug: '\x1b[90m[DEBUG]\x1b[0m'
    }[level] || '[LOG]';

    console.log(`${levelPrefix} [${source}] ${message}`, data || '');

    return log;
  }

  error(source, message, data = null, metadata = {}) {
    return this._add('error', source, message, data, metadata);
  }

  warn(source, message, data = null, metadata = {}) {
    return this._add('warn', source, message, data, metadata);
  }

  info(source, message, data = null, metadata = {}) {
    return this._add('info', source, message, data, metadata);
  }

  debug(source, message, data = null, metadata = {}) {
    if (process.env.NODE_ENV === 'development') {
      return this._add('debug', source, message, data, metadata);
    }
    return null;
  }

  // Log API requests
  logRequest(req, res, durationMs) {
    const level = res.statusCode >= 500 ? 'error' : 
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    return this._add(level, 'api', `${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      durationMs,
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.id || 'anonymous',
      ip: req.ip
    });
  }

  // Get logs with filters
  getLogs(filters = {}) {
    let result = [...this.logs];

    // Filter by level
    if (filters.level && filters.level !== 'all') {
      result = result.filter(log => log.level === filters.level);
    }

    // Filter by source
    if (filters.source && filters.source !== 'all') {
      result = result.filter(log => log.source === filters.source);
    }

    // Filter by time range
    if (filters.since) {
      const sinceMs = Date.now() - (filters.since * 60 * 1000);
      result = result.filter(log => log.timestamp >= sinceMs);
    }

    // Filter by search text
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
      );
    }

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = Math.min(parseInt(filters.limit) || 100, 500);
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      logs: result.slice(start, end),
      total: result.length,
      page,
      limit,
      totalPages: Math.ceil(result.length / limit)
    };
  }

  // Clear all logs
  clear() {
    const count = this.logs.length;
    this.logs = [];
    return { cleared: count };
  }

  // Get stats
  getStats() {
    const now = Date.now();
    const recentCutoff = now - this.LOG_TTL;
    
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

// Singleton instance
const logger = new Logger();

// Start auto cleanup
logger.startAutoCleanup(60000); // Every minute
logger.cleanup(); // Initial cleanup

module.exports = logger;
