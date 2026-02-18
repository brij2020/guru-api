const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const logger = require('./config/logger');
const errorHandler = require('./errors/errorHandler');
const ApiError = require('./errors/apiError');
const { port, corsOrigin, nodeEnv } = require('./config/env');
const registerAuthRoutes = require('./routes/v1/auth');
const registerTaskRoutes = require('./routes/v1/tasks');

const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev', { stream: logger.stream }));
app.use(express.json({ limit: '10kb' }));

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

registerAuthRoutes(app);
registerTaskRoutes(app);

app.use((req, res, next) => {
  next(new ApiError(404, 'Route not found'));
});

app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    logger.info(`Backend API listening on port ${port}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start API server', { error: error.message });
  process.exit(1);
});
