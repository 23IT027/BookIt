const Payment = require('../models/payment.model');
const Booking = require('../models/booking.model');
const AppointmentType = require('../models/appointmentType.model');
const User = require('../models/user.model');
const stripeService = require('../services/stripe.service');
const { ok, notFound, badRequest, forbidden } = require('../helpers/response.helper');

/**
 * Payment Controller - handles Stripe payment integration
 */

// Create Stripe checkout session
const createCheckoutSession = async (req, res) => {
  const { bookingId } = req.body;
  const customerId = req.user._id;

  // Get booking with related data
  const booking = await Booking.findById(bookingId)
    .populate('appointmentTypeId')
    .populate('customerId');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  // Verify ownership
  if (booking.customerId._id.toString() !== customerId.toString()) {
    return forbidden(res, 'You can only pay for your own bookings');
  }

  // Check if already paid
  if (booking.paymentStatus === 'PAID') {
    return badRequest(res, 'This booking has already been paid');
  }

  // Check if booking is cancelled
  if (booking.status === 'CANCELLED') {
    return badRequest(res, 'Cannot pay for a cancelled booking');
  }

  // Check if appointment has price
  if (booking.appointmentTypeId.price === 0) {
    return badRequest(res, 'This appointment is free, no payment required');
  }

  try {
    // Create Stripe checkout session
    const { sessionId, sessionUrl } = await stripeService.createCheckoutSession(
      booking,
      booking.appointmentTypeId,
      booking.customerId
    );

    // Update booking payment status
    booking.paymentStatus = 'PROCESSING';
    await booking.save();

    return ok(res, 'Checkout session created successfully', {
      sessionId,
      sessionUrl,
      bookingId: booking._id
    });
  } catch (error) {
    console.error('Checkout session creation failed:', error);
    return badRequest(res, error.message);
  }
};

// Create Stripe checkout session for guest bookings (no auth required)
const createGuestCheckoutSession = async (req, res) => {
  const { bookingId, email } = req.body;

  if (!bookingId || !email) {
    return badRequest(res, 'Booking ID and email are required');
  }

  // Get booking with related data
  const booking = await Booking.findById(bookingId)
    .populate('appointmentTypeId')
    .populate('providerId');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  // Verify this is a guest booking
  if (!booking.isGuestBooking) {
    return badRequest(res, 'This is not a guest booking. Please login to pay.');
  }

  // Verify email matches
  if (booking.guestInfo?.email?.toLowerCase() !== email.toLowerCase()) {
    return forbidden(res, 'Email does not match the booking');
  }

  // Check if already paid
  if (booking.paymentStatus === 'PAID') {
    return badRequest(res, 'This booking has already been paid');
  }

  // Check if booking is cancelled
  if (booking.status === 'CANCELLED') {
    return badRequest(res, 'Cannot pay for a cancelled booking');
  }

  // Check if appointment has price
  if (booking.appointmentTypeId.price === 0) {
    return badRequest(res, 'This appointment is free, no payment required');
  }

  try {
    // Create Stripe checkout session for guest
    const { sessionId, sessionUrl } = await stripeService.createGuestCheckoutSession(
      booking,
      booking.appointmentTypeId,
      booking.guestInfo
    );

    // Update booking payment status
    booking.paymentStatus = 'PROCESSING';
    await booking.save();

    return ok(res, 'Checkout session created successfully', {
      sessionId,
      sessionUrl,
      bookingId: booking._id
    });
  } catch (error) {
    console.error('Guest checkout session creation failed:', error);
    return badRequest(res, error.message);
  }
};

// Stripe webhook endpoint
const handleWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).send('No signature provided');
  }

  try {
    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(
      req.body,
      signature
    );

    console.log(`📡 Webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await stripeService.handlePaymentSuccess(event.data.object);
        break;

      case 'checkout.session.expired':
      case 'payment_intent.payment_failed':
        await stripeService.handlePaymentFailure(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

// Get payment by booking ID
const getPaymentByBookingId = async (req, res) => {
  const { bookingId } = req.params;

  const payment = await Payment.findOne({ bookingId })
    .populate('bookingId')
    .populate('customerId', 'name email');

  if (!payment) {
    return notFound(res, 'Payment not found for this booking');
  }

  // Check access
  const isCustomer = payment.customerId._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'ADMIN';

  if (!isCustomer && !isAdmin) {
    return forbidden(res, 'You do not have access to this payment');
  }

  return ok(res, 'Payment retrieved successfully', {
    payment
  });
};

// Get all payments for a customer
const getCustomerPayments = async (req, res) => {
  const customerId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { customerId };

  if (status) {
    query.status = status.toUpperCase();
  }

  const payments = await Payment.find(query)
    .populate({
      path: 'bookingId',
      populate: [
        { path: 'appointmentTypeId', select: 'title' },
        { path: 'providerId', select: 'name' }
      ]
    })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Payment.countDocuments(query);

  return ok(res, 'Payments retrieved successfully', {
    payments,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total,
      hasMore: page * limit < total
    }
  });
};

// Request refund
const requestRefund = async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body;

  const payment = await Payment.findById(paymentId)
    .populate('bookingId');

  if (!payment) {
    return notFound(res, 'Payment not found');
  }

  // Verify ownership
  if (payment.customerId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only request refunds for your own payments');
  }

  // Check if already refunded
  if (payment.status === 'REFUNDED') {
    return badRequest(res, 'This payment has already been refunded');
  }

  if (payment.status !== 'SUCCEEDED') {
    return badRequest(res, 'Can only refund successful payments');
  }

  // Check booking cancellation policy
  const booking = payment.bookingId;
  if (!booking) {
    return badRequest(res, 'Associated booking not found');
  }

  try {
    // Calculate refund amount based on policy
    const appointmentType = await AppointmentType.findById(booking.appointmentTypeId);
    let refundAmount = payment.amount;

    if (appointmentType && appointmentType.cancellationPolicy) {
      const policy = appointmentType.cancellationPolicy;
      refundAmount = (payment.amount * policy.refundPercentage) / 100;
    }

    // Create refund in Stripe
    await stripeService.createRefund(paymentId, refundAmount, reason);

    return ok(res, 'Refund processed successfully', {
      refundAmount,
      originalAmount: payment.amount
    });
  } catch (error) {
    console.error('Refund failed:', error);
    return badRequest(res, error.message);
  }
};

// Verify and confirm payment (for when webhooks don't work)
const verifyPayment = async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return badRequest(res, 'Session ID is required');
  }

  try {
    // Find payment by checkout session ID
    let payment = await Payment.findOne({ stripeCheckoutSessionId: sessionId });

    if (!payment) {
      return notFound(res, 'Payment not found');
    }

    // If already succeeded, return success
    if (payment.status === 'SUCCEEDED') {
      const booking = await Booking.findById(payment.bookingId)
        .populate('appointmentTypeId')
        .populate('providerId');
      
      return ok(res, 'Payment already verified', {
        payment,
        booking
      });
    }

    // Check with Stripe directly
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Update payment record
      payment = await Payment.findByIdAndUpdate(
        payment._id,
        {
          status: 'SUCCEEDED',
          stripePaymentIntentId: session.payment_intent,
          paidAt: new Date()
        },
        { new: true }
      );

      // Update booking
      const booking = await Booking.findByIdAndUpdate(
        payment.bookingId,
        {
          paymentStatus: 'PAID',
          status: 'CONFIRMED'
        },
        { new: true }
      ).populate('appointmentTypeId').populate('providerId');

      // Get receipt URL
      if (session.payment_intent) {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        if (paymentIntent.latest_charge) {
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
          if (charge.receipt_url) {
            await Payment.findByIdAndUpdate(payment._id, { receiptUrl: charge.receipt_url });
          }
        }
      }

      console.log(`✅ Payment verified and confirmed for session ${sessionId}`);

      return ok(res, 'Payment verified successfully', {
        payment,
        booking
      });
    } else {
      return badRequest(res, `Payment not completed. Status: ${session.payment_status}`);
    }
  } catch (error) {
    console.error('Payment verification failed:', error);
    return badRequest(res, `Payment verification failed: ${error.message}`);
  }
};

module.exports = {
  createCheckoutSession,
  createGuestCheckoutSession,
  handleWebhook,
  getPaymentByBookingId,
  getCustomerPayments,
  requestRefund,
  verifyPayment
};
