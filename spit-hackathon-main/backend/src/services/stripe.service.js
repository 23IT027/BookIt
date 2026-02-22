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
      const bookingId = session.client_reference_id;
      const paymentIntentId = session.payment_intent;

      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { stripeCheckoutSessionId: session.id },
        {
          stripePaymentIntentId: paymentIntentId,
          status: 'SUCCEEDED',
          paidAt: new Date()
        },
        { new: true }
      );

      if (!payment) {
        console.error('Payment record not found for session:', session.id);
        return;
      }

      // Update booking status
      const booking = await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: 'PAID',
        status: 'CONFIRMED'
      }, { new: true })
        .populate('appointmentTypeId')
        .populate('providerId')
        .populate('customerId', 'name email');

      // Get payment intent for receipt URL
      if (paymentIntentId) {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.charges.data[0]) {
          await Payment.findByIdAndUpdate(payment._id, {
            receiptUrl: paymentIntent.charges.data[0].receipt_url
          });
        }
      }

      console.log(`✅ Payment succeeded for booking ${bookingId}`);

      // 📧 Send confirmation email with calendar invite (async - don't block)
      if (booking) {
        (async () => {
          try {
            const calendarContent = await calendarService.generateCalendarInvite(booking);
            await emailService.sendBookingConfirmationEmail(booking, calendarContent);
            await emailService.sendProviderBookingNotification(booking);
            console.log(`📧 Payment confirmation emails sent for booking: ${bookingId}`);
          } catch (emailError) {
            console.error(`❌ Failed to send payment confirmation emails:`, emailError);
          }
        })();
      }

      return payment;
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
      const bookingId = session.client_reference_id;

      // Update payment record
      await Payment.findOneAndUpdate(
        { stripeCheckoutSessionId: session.id },
        {
          status: 'FAILED',
          failureReason: 'Payment failed or was cancelled'
        }
      );

      // Update booking status
      await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: 'FAILED',
        status: 'CANCELLED'
      });

      console.log(`❌ Payment failed for booking ${bookingId}`);
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
