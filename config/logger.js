const winston = require('winston');

const isProd = process.env.NODE_ENV === 'production';
const SERVICE_NAME = 'aiguru-api';

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  if (isProd) return `${timestamp} [${level.toUpperCase()}] ${message}${metaString}`;
  return `${message}${metaString}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    isProd
      ? winston.format.json()
      : customFormat
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
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    const payload = {
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

    logger[level](JSON.stringify(payload, null, 2));
  });

  res.on('error', (err) => {
    const payload = {
      service: SERVICE_NAME,
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      stack: err.stack,
      statusCode: res.statusCode,
    };

    logger.error(JSON.stringify(payload, null, 2));
  });

  next();
};

module.exports = { logger, httpLogger };
