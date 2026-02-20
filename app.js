require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const config = require('./config/env');
const { logger, httpLogger } = require('./config/logger');
const errorHandler = require('./errors/errorHandler');
const ApiError = require('./errors/apiError');
const { seedAdminUser } = require('./services/seedService');

const app = express();

const isPrivateIpv4 = (hostname) => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  const octets = hostname.split('.').map(Number);
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return false;
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254)
  );
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return true;
  if (!config.corsAllowPrivateNetwork) return false;

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    return host === 'localhost' || host.endsWith('.local') || isPrivateIpv4(host);
  } catch (error) {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(httpLogger);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome Guru API.' });
});

app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

require('./routes')(app);

app.use((req, res, next) => {
  next(new ApiError(404, 'Route not found'));
});

app.use(errorHandler);

const bootstrapDatabase = async () => {
  if (process.env.NODE_ENV === 'test') {
    logger.info('Skipping DB connect in test environment');
    return;
  }
  await connectDB();
  await seedAdminUser();
};

if (require.main === module) {
  bootstrapDatabase()
    .then(() => {
      app.listen(config.port, config.host, () => {
       
        logger.info('########################################');
        logger.info(
          `🚀 Server started successfully on ${config.host}:${config.port} in ${config.name} mode`
        );
        logger.info(`📊 Environment: ${String(config.name).toUpperCase()}`);
        logger.info(`🗄️  Database URL: ${config.mongoUri}`);
        logger.info(`🔗 API URL: ${config.apiUrl}`);
        logger.info(`📱 Frontend URL: ${config.frontendUrl}`);
        logger.info('########################################');
      });
    })
    .catch((error) => {
      logger.error('Failed to start API server', { error: error.message });
      process.exit(1);
    });
}

module.exports = app;
