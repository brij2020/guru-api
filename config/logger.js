const { createLogger, transports, format } = require('winston');
const { logLevel, nodeEnv } = require('./env');

const formatter = format.combine(
  format.timestamp(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
  })
);

const logger = createLogger({
  level: logLevel,
  format: nodeEnv === 'production' ? format.json() : formatter,
  transports: [
    new transports.Console({ stderrLevels: ['error'] }),
  ],
  exitOnError: false,
});

logger.stream = {
  write(message = '') {
    logger.info(message.trim());
  },
};

module.exports = logger;
