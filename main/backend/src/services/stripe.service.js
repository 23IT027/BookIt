const { getStripeClient } = require('../config/stripe');
const config = require('../config/env');
const Payment = require('../models/payment.model');
const Booking = require('../models/booking.model');
const emailService = require('./email.service');
const calendarService = require('./calendar.service');

/**
 * Stripe payment service
 */

class StripeService {
  constructor() {
    this.stripe = getStripeClient();
  }

  /**
   * Create a Stripe Checkout Session for booking payment
   */
  async createCheckoutSession(booking, appointmentType, customer) {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Force INR for Indian payments
    const currency = 'inr';
    const amount = Math.round(appointmentType.price * 100); // Convert to paise

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency,
              product_data: {
                name: appointmentType.title,
                description: appointmentType.description || '',
                images: appointmentType.images.map(img => img.url).slice(0, 1)
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.stripe.cancelUrl}?booking_id=${booking._id}`,
        client_reference_id: booking._id.toString(),
        customer_email: customer.email,
        metadata: {
          bookingId: booking._id.toString(),
          customerId: customer._id.toString(),
          appointmentTypeId: appointmentType._id.toString()
        }
      });

      // Create payment record
      await Payment.create({
        bookingId: booking._id,
        customerId: customer._id,
        stripeCheckoutSessionId: session.id,
        amount: appointmentType.price,
        currency: 'INR',
        status: 'PENDING',
        paymentMethod: 'STRIPE'
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url
      };
    } catch (error) {
      console.error('Stripe checkout session creation failed:', error);
      throw new Error(`Payment session creation failed: ${error.message}`);
    }
  }

  /**
   * Create a single Stripe Checkout Session for MULTIPLE bookings
   */
  async createMultiBookingCheckoutSession(bookings, customer) {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const currency = 'inr';
    const bookingIds = bookings.map(b => b._id.toString());

    // Build one line-item per booking
    const line_items = bookings.map(booking => {
      const apt = booking.appointmentTypeId;
      const slotTime = new Date(booking.startTime).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      return {
        price_data: {
          currency,
          product_data: {
            name: `${apt.title} — ${slotTime}`,
            description: apt.description || ''
          },
          unit_amount: Math.round(apt.price * 100)
        },
        quantity: 1
      };
    });

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.stripe.cancelUrl}?booking_id=${bookingIds[0]}`,
        client_reference_id: bookingIds.join(','),
        customer_email: customer.email,
        metadata: {
          bookingIds: bookingIds.join(','),
          customerId: customer._id.toString(),
          isMultiBooking: 'true'
        }
      });

      // Create a Payment record for each booking
      const totalAmount = bookings.reduce((sum, b) => sum + b.appointmentTypeId.price, 0);
      for (const booking of bookings) {
        await Payment.create({
          bookingId: booking._id,
          customerId: customer._id,
          stripeCheckoutSessionId: session.id,
          amount: booking.appointmentTypeId.price,
          currency: 'INR',
          status: 'PENDING',
          paymentMethod: 'STRIPE'
        });
      }

      return {
        sessionId: session.id,
        sessionUrl: session.url
      };
    } catch (error) {
      console.error('Multi-booking Stripe checkout session creation failed:', error);
      throw new Error(`Payment session creation failed: ${error.message}`);
    }
  }

  /**
   * Create a Stripe Checkout Session for guest booking payment
   */
  async createGuestCheckoutSession(booking, appointmentType, guestInfo) {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Force INR for Indian payments
    const currency = 'inr';
    const amount = Math.round(appointmentType.price * 100); // Convert to paise

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency,
              product_data: {
                name: appointmentType.title,
                description: appointmentType.description || '',
                images: (appointmentType.images || []).map(img => img.url).slice(0, 1)
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}&guest=true`,
        cancel_url: `${config.stripe.cancelUrl}?booking_id=${booking._id}&guest=true`,
        client_reference_id: booking._id.toString(),
        customer_email: guestInfo.email,
        metadata: {
          bookingId: booking._id.toString(),
          isGuestBooking: 'true',
          guestName: guestInfo.name,
          guestEmail: guestInfo.email,
          appointmentTypeId: appointmentType._id.toString()
        }
      });

      // Create payment record for guest (no customerId)
      await Payment.create({
        bookingId: booking._id,
        customerId: null,
        stripeCheckoutSessionId: session.id,
        amount: appointmentType.price,
        currency: 'INR',
        status: 'PENDING',
        paymentMethod: 'STRIPE',
        metadata: {
          isGuestBooking: true,
          guestEmail: guestInfo.email,
          guestName: guestInfo.name
        }
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url
      };
    } catch (error) {
      console.error('Guest Stripe checkout session creation failed:', error);
      throw new Error(`Payment session creation failed: ${error.message}`);
    }
  }

  /**
   * Handle successful payment from webhook
   */
  async handlePaymentSuccess(session) {
    try {
      const clientRef = session.client_reference_id;
      const paymentIntentId = session.payment_intent;
      const isMulti = session.metadata?.isMultiBooking === 'true';
      const bookingIds = clientRef.includes(',') ? clientRef.split(',') : [clientRef];

      // Update ALL payment records that share this checkout session
      await Payment.updateMany(
        { stripeCheckoutSessionId: session.id },
        {
          stripePaymentIntentId: paymentIntentId,
          status: 'SUCCEEDED',
          paidAt: new Date()
        }
      );

      // Update ALL bookings
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        { paymentStatus: 'PAID', status: 'CONFIRMED' }
      );

      // Get receipt URL
      if (paymentIntentId) {
        try {
          const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
          const receiptUrl = paymentIntent.charges?.data?.[0]?.receipt_url
            || paymentIntent.latest_charge?.receipt_url;
          if (receiptUrl) {
            await Payment.updateMany(
              { stripeCheckoutSessionId: session.id },
              { receiptUrl }
            );
          }
        } catch (e) {
          console.error('Could not fetch receipt URL:', e.message);
        }
      }

      console.log(`✅ Payment succeeded for booking(s) ${bookingIds.join(', ')}`);

      // 📧 Send confirmation emails for each booking (async)
      (async () => {
        for (const bId of bookingIds) {
          try {
            const booking = await Booking.findById(bId)
              .populate('appointmentTypeId')
              .populate('providerId')
              .populate('customerId', 'name email');
            if (booking) {
              const calendarContent = await calendarService.generateCalendarInvite(booking);
              await emailService.sendBookingConfirmationEmail(booking, calendarContent);
              await emailService.sendProviderBookingNotification(booking);
            }
          } catch (emailError) {
            console.error(`❌ Failed to send confirmation email for booking ${bId}:`, emailError);
          }
        }
        console.log(`📧 Confirmation emails sent for ${bookingIds.length} booking(s)`);
      })();

      return true;
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment from webhook
   */
  async handlePaymentFailure(session) {
    try {
      const clientRef = session.client_reference_id;
      const bookingIds = clientRef.includes(',') ? clientRef.split(',') : [clientRef];

      // Update ALL payment records
      await Payment.updateMany(
        { stripeCheckoutSessionId: session.id },
        {
          status: 'FAILED',
          failureReason: 'Payment failed or was cancelled'
        }
      );

      // Update ALL bookings
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        { paymentStatus: 'FAILED', status: 'CANCELLED' }
      );

      console.log(`❌ Payment failed for booking(s) ${bookingIds.join(', ')}`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(paymentId, amount = null, reason = '') {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!payment.stripePaymentIntentId) {
        throw new Error('No Stripe payment intent found');
      }

      if (payment.status !== 'SUCCEEDED') {
        throw new Error('Can only refund successful payments');
      }

      // Create refund
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: 'requested_by_customer',
        metadata: {
          paymentId: payment._id.toString(),
          bookingId: payment.bookingId.toString(),
          reason: reason || 'Customer requested refund'
        }
      });

      // Update payment record
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'REFUNDED',
        refundAmount: refund.amount / 100,
        refundReason: reason,
        refundedAt: new Date()
      });

      // Update booking payment status
      await Booking.findByIdAndUpdate(payment.bookingId, {
        paymentStatus: 'REFUNDED'
      });

      console.log(`✅ Refund created for payment ${paymentId}`);
      return refund;
    } catch (error) {
      console.error('Refund creation failed:', error);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!config.stripe.webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

module.exports = new StripeService();
