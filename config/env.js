const path = require('path');
const dotenv = require('dotenv');

const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = nodeEnv === 'production' ? undefined : path.join(process.cwd(), '.env');

dotenv.config({ path: envPath });

const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0 && nodeEnv !== 'test') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const port = Number(process.env.PORT) || 4000;
const logLevel = process.env.LOG_LEVEL || 'info';
const corsOrigin = process.env.CORS_ORIGIN || '*';
const requestWindowMs = Number(process.env.REQUEST_WINDOW_MS) || 15 * 60 * 1000;
const requestLimit = Number(process.env.REQUEST_LIMIT) || 200;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

module.exports = {
  nodeEnv,
  port,
  logLevel,
  corsOrigin,
  mongoUri: process.env.MONGODB_URI,
  requestWindowMs,
  requestLimit,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn,
  jwtRefreshExpiresIn,
  bcryptSaltRounds,
};
