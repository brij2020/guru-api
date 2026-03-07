const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const resolveRuntimeEnv = (value) => {
  const normalized = String(value || 'local').toLowerCase();
  if (normalized === 'development') return 'local';
  if (['local', 'stg', 'test', 'production'].includes(normalized)) return normalized;
  return 'local';
};

const nodeEnv = resolveRuntimeEnv(process.env.NODE_ENV);
const envCandidates = [
  `.env.${nodeEnv}`,
  '.env',
];

const selectedEnvFile = envCandidates
  .map((file) => path.join(process.cwd(), file))
  .find((filePath) => fs.existsSync(filePath));

if (selectedEnvFile) {
  dotenv.config({ path: selectedEnvFile });
}

const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0 && nodeEnv !== 'test') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
const name = nodeEnv;
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
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '2mb';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '30m';
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
const apiUrl = process.env.API_URL || `http://localhost:${port}`;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const seedAdminOnBoot = String(process.env.SEED_ADMIN_ON_BOOT || 'false').toLowerCase() === 'true';
const seedAdminName = process.env.SEED_ADMIN_NAME || '';
const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || '';
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || '';
const aiProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const geminiModels = Array.from(
  new Set(
    [
      geminiModel,
      ...(process.env.GEMINI_MODELS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ].filter(Boolean)
  )
);

module.exports = {
  nodeEnv,
  envFile: selectedEnvFile || null,
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
  requestBodyLimit,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn,
  jwtRefreshExpiresIn,
  bcryptSaltRounds,
  apiUrl,
  frontendUrl,
  seedAdminOnBoot,
  seedAdminName,
  seedAdminEmail,
  seedAdminPassword,
  aiProvider,
  openaiApiKey,
  openaiBaseUrl,
  openaiModel,
  geminiApiKey,
  geminiModel,
  geminiModels,
};
