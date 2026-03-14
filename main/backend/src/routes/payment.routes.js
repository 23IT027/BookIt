const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Webhook route (must be before body parser middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Guest checkout route (no auth required)
router.post('/guest-checkout', paymentController.createGuestCheckoutSession);

// Verify payment route (called from success page, checks with Stripe directly)
router.get('/verify/:sessionId', paymentController.verifyPayment);

// Protected routes
router.use(authenticate);

router.post('/create-checkout', paymentController.createCheckoutSession);
router.get('/booking/:bookingId', paymentController.getPaymentByBookingId);
router.get('/customer', paymentController.getCustomerPayments);
router.post('/:paymentId/refund', paymentController.requestRefund);

module.exports = router;
