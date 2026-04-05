const crypto = require('crypto');
const UserSubscription = require('../models/userSubscription');
const SubscriptionPlan = require('../models/subscriptionPlan');
const { PAYTM_MERCHANT_KEY, PAYTM_MID, PAYTM_WEBSITE, PAYTM_CALLBACK_URL, PAYTM_ENV } = require('../config/env');

const PAYTM_STATUS_URL = PAYTM_ENV === 'production'
  ? 'https://securegw.paytm.in/v3/order/status'
  : 'https://securegw-stage.paytm.in/v3/order/status';

const PAYTM_INIT_URL = PAYTM_ENV === 'production'
  ? 'https://securegw.paytm.in/theia/api/v1/initiateTransaction'
  : 'https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction';

const generateChecksum = (params, key) => {
  const paytmParams = {};
  Object.keys(params).sort().forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      paytmParams[key] = params[key].toString();
    }
  });

  const checksum = crypto.createHmac('sha256', key);
  checksum.update(JSON.stringify(paytmParams));
  const signature = checksum.getHmac('hex');
  return signature;
};

const verifyChecksum = (params, key) => {
  if (!params || !params.CHECKSUMHASH) return false;

  const paytmParams = {};
  Object.keys(params).forEach(key => {
    if (key !== 'CHECKSUMHASH' && params[key] !== undefined && params[key] !== null) {
      paytmParams[key] = params[key].toString();
    }
  });

  const expectedChecksum = generateChecksum(paytmParams, key);
  return expectedChecksum === params.CHECKSUMHASH;
};

const createPaymentOrder = async (req, res) => {
  try {
    const { planId, cycle } = req.body;
    const userId = req.user.id;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    const pricing = plan.pricing[cycle];
    if (!pricing || !pricing.enabled) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    const amount = pricing.amount.toString();
    const orderId = `SUB_${userId}_${planId}_${cycle}_${Date.now()}`;

    const existingActive = await UserSubscription.findOne({
      userId,
      status: { $in: ['active', 'paused', 'trial'] },
    });

    if (existingActive) {
      existingActive.status = 'cancelled';
      existingActive.cancellation = {
        isCancelled: true,
        cancelledAt: new Date(),
        willExpireAt: existingActive.billing.endDate,
      };
      await existingActive.save();
    }

    const tempSubscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: 'pending',
      cycle,
      pricing: {
        amountPaid: pricing.amount,
        currency: pricing.currency,
      },
      payment: {
        orderId,
        paymentGateway: 'paytm',
        paymentStatus: 'pending',
      },
      metadata: {
        source: 'website',
      },
    });
    await tempSubscription.save();

    const callbackUrl = `${PAYTM_CALLBACK_URL}/${orderId}`;

    const paytmParams = {
      MID: PAYTM_MID,
      ORDER_ID: orderId,
      CUST_ID: userId.toString(),
      TXN_AMOUNT: amount,
      CHANNEL_ID: 'WEB',
      INDUSTRY_TYPE_ID: 'Retail',
      WEBSITE: PAYTM_WEBSITE,
      CALLBACK_URL: callbackUrl,
      MOBILE_NO: user.phone || '',
      EMAIL: user.email || '',
    };

    const checksum = generateChecksum(paytmParams, PAYTM_MERCHANT_KEY);

    res.json({
      data: {
        orderId,
        amount,
        currency: pricing.currency,
        planName: plan.name,
        cycle,
        subscriptionId: tempSubscription._id,
        paytmParams: {
          ...paytmParams,
          CHECKSUMHASH: checksum,
        },
        paytmUrl: PAYTM_INIT_URL,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const paymentCallback = async (req, res) => {
  try {
    const { ORDER_ID, TXNID, TXN_AMOUNT, STATUS, PAYTMMODE, CHECKSUMHASH } = req.body;

    if (!verifyChecksum(req.body, PAYTM_MERCHANT_KEY)) {
      return res.redirect(`${PAYTM_CALLBACK_URL}?status=error&message=checksum_failed`);
    }

    const subscription = await UserSubscription.findOne({
      'payment.orderId': ORDER_ID,
    }).populate('planId');

    if (!subscription) {
      return res.redirect(`${PAYTM_CALLBACK_URL}?status=error&message=subscription_not_found`);
    }

    subscription.payment = {
      ...subscription.payment,
      transactionId: TXNID || null,
      paymentStatus: STATUS === 'TXN_SUCCESS' ? 'completed' : 'failed',
      paymentDetails: req.body,
    };

    if (STATUS === 'TXN_SUCCESS') {
      const duration = subscription.cycle === 'yearly' ? 365 : 30;
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

      subscription.status = 'active';
      subscription.billing = {
        startDate,
        endDate,
        nextBillingDate: subscription.cycle === 'monthly' ? endDate : null,
        lastBillingDate: startDate,
      };
      subscription.usage = {
        mockTestsThisWeek: 0,
        mockTestsThisMonth: 0,
        expressShareTokensUsed: 0,
        lastResetAt: startDate,
      };
    } else {
      subscription.status = 'failed';
    }

    await subscription.save();

    const redirectUrl = STATUS === 'TXN_SUCCESS'
      ? `${PAYTM_CALLBACK_URL}?status=success&orderId=${ORDER_ID}`
      : `${PAYTM_CALLBACK_URL}?status=failed&orderId=${ORDER_ID}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Paytm callback error:', error);
    res.redirect(`${PAYTM_CALLBACK_URL}?status=error&message=${encodeURIComponent(error.message)}`);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const subscription = await UserSubscription.findOne({
      'payment.orderId': orderId,
    }).populate('planId');

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({
      data: {
        orderId,
        status: subscription.payment.paymentStatus,
        transactionId: subscription.payment.transactionId,
        subscription: subscription.toPublic(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const refundPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const subscription = await UserSubscription.findOne({
      'payment.orderId': orderId,
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.payment.paymentStatus !== 'completed') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    subscription.payment.paymentStatus = 'refunded';
    subscription.status = 'cancelled';
    await subscription.save();

    res.json({ data: subscription.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPaymentStatus = async (orderId) => {
  try {
    const paytmParams = {
      MID: PAYTM_MID,
      ORDER_ID: orderId,
    };

    const checksum = generateChecksum(paytmParams, PAYTM_MERCHANT_KEY);
    paytmParams.CHECKSUMHASH = checksum;

    const response = await fetch(PAYTM_STATUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paytmParams),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Paytm status check error:', error);
    return null;
  }
};

module.exports = {
  createPaymentOrder,
  paymentCallback,
  verifyPayment,
  refundPayment,
  getPaymentStatus,
};
