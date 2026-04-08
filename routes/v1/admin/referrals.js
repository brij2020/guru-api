const express = require('express');
const router = express.Router();
const isAdmin = require('../../../middleware/isAdmin');
const { getAdminReferralStats, updateReferralConfig, getReferralConfig } = require('../../../controllers/referralController');

router.get('/stats', isAdmin, getAdminReferralStats);
router.get('/config', isAdmin, getReferralConfig);
router.put('/config', isAdmin, updateReferralConfig);

module.exports = (app) => {
  app.use('/api/v1/admin/referrals', router);
};
