const mongoose = require('mongoose');
const logger = require('./logger');
const { mongoUri, nodeEnv } = require('./env');

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (!mongoUri) {
    throw new Error('MongoDB connection string is not defined.');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection failed', { error: error.message });
    if (nodeEnv === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
