const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const { 
  getReferralCode, 
  getReferralStats, 
  recordShare, 
  validateReferralCode,
  getReferralConfig,
} = require('../../controllers/referralController');

router.get('/code', authenticate, getReferralCode);
router.get('/stats', authenticate, getReferralStats);
router.post('/share', authenticate, recordShare);
router.get('/validate/:code', validateReferralCode);
router.get('/config', getReferralConfig);

module.exports = (app) => {
  app.use('/api/v1/referrals', router);
};
