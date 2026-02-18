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
const host = process.env.HOST || '0.0.0.0';
const name = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || 'info';
const corsOrigin = process.env.CORS_ORIGIN || '*';
const corsOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsAllowPrivateNetwork = String(
  process.env.CORS_ALLOW_PRIVATE_NETWORK || 'false'
).toLowerCase() === 'true';
const requestWindowMs = Number(process.env.REQUEST_WINDOW_MS) || 15 * 60 * 1000;
const requestLimit = Number(process.env.REQUEST_LIMIT) || 200;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const apiUrl = process.env.API_URL || `http://localhost:${port}`;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

module.exports = {
  nodeEnv,
  port,
  host,
  name,
  logLevel,
  corsOrigin,
  corsOrigins,
  corsAllowPrivateNetwork,
  mongoUri: process.env.MONGODB_URI,
  requestWindowMs,
  requestLimit,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn,
  jwtRefreshExpiresIn,
  bcryptSaltRounds,
  apiUrl,
  frontendUrl,
};
