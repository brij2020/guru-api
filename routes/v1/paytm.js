const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const isAdmin = require('../../middleware/isAdmin');
const paytmController = require('../../controllers/paytmController');

router.post('/create-order', authenticate, asyncHandler(paytmController.createPaymentOrder));

router.post('/callback', asyncHandler(paytmController.paymentCallback));

router.get('/verify/:orderId', authenticate, asyncHandler(paytmController.verifyPayment));

router.post('/refund/:orderId', authenticate, isAdmin, asyncHandler(paytmController.refundPayment));

module.exports = (app) => {
  app.use('/api/v1/paytm', router);
};
