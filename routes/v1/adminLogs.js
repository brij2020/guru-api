const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const { logStore } = require('../../config/logger');

module.exports = (app) => {
  const router = express.Router();

  // GET /api/v1/admin/logs - Get logs with filters
  router.get('/logs', authenticate, asyncHandler(async (req, res) => {
    const { level, source, since, search, page, limit } = req.query;
    
    const filters = {
      level: level || 'all',
      source: source || 'all',
      since: since ? parseInt(since) : 15,
      search: search || '',
      page: page || 1,
      limit: limit || 100
    };

    const result = logStore.query(filters);
    const stats = logStore.stats();

    res.json({
      success: true,
      data: {
        ...result,
        stats
      }
    });
  }));

  // GET /api/v1/admin/logs/stats - Get log stats only
  router.get('/logs/stats', authenticate, asyncHandler(async (req, res) => {
    const stats = logStore.stats();
    res.json({
      success: true,
      data: stats
    });
  }));

  // DELETE /api/v1/admin/logs - Clear all logs
  router.delete('/logs', authenticate, asyncHandler(async (req, res) => {
    const result = logStore.clear();
    res.json({
      success: true,
      data: result
    });
  }));

  app.use('/api/v1/admin', router);
};
