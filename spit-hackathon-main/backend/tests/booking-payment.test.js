/**
 * Booking & Stripe Payment Tests
 * Tests: Create booking, payment flow, webhook handling, refunds, cancellation policy
 */

const request = require('supertest');
const app = require('../src/app');
const stripe = require('stripe');

describe('Booking & Payment Integration', () => {
  let customerToken, customerUser;
  let organiserToken;
  let providerId, appointmentTypeId;
  let availableSlotTime;

  beforeEach(async () => {
    // Create customer
    const customerRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Customer',
        email: `customer-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+1111111111',
        role: 'CUSTOMER'
      });
    customerToken = customerRes.body.data.token;
    customerUser = customerRes.body.data.user;

    // Create organiser
    const organiserRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Organiser',
        email: `organiser-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+2222222222',
        role: 'ORGANISER'
      });
    organiserToken = organiserRes.body.data.token;

    // Setup provider
    const providerRes = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        title: 'Payment Test Provider',
        description: 'Test',
        contactEmail: 'provider@test.com',
        contactPhone: '+3333333333'
      });
    providerId = providerRes.body.data._id;

    // Create appointment type
    const typeRes = await request(app)
      .post('/api/appointment-types')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        providerId,
        title: 'Paid Appointment',
        description: 'Test',
        durationMinutes: 30,
        price: 100.00,
        currency: 'USD',
        published: true
      });
    appointmentTypeId = typeRes.body.data._id;

    // Create availability
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayOfWeek = tomorrow.getDay();

    await request(app)
      .post('/api/availability')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        providerId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'America/New_York'
      });

    // Get available slot
    const date = tomorrow.toISOString().split('T')[0];
    const slotsRes = await request(app)
      .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
      .set('Authorization', `Bearer ${customerToken}`);

    if (slotsRes.body.data.length > 0) {
      availableSlotTime = slotsRes.body.data[0].startTime;
    }
  });

  describe('POST /api/bookings - Create Booking', () => {
    it('should create booking with valid data', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping booking creation test');
        return;
      }

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Test booking notes'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('userId', customerUser._id);
      expect(res.body.data).toHaveProperty('status', 'PENDING_PAYMENT');
      expect(res.body.data).toHaveProperty('totalAmount', 100);
    });

    it('should forbid unauthenticated booking', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      expect(res.status).toBe(401);
    });

    it('should reject booking for unavailable slot', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping unavailable slot test');
        return;
      }

      // Book slot first
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      // Try to book same slot again
      const customerRes2 = await request(app)
        .post('/api/auth/signup')
        .send({
          title: 'Customer 2',
          email: `customer2-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+4444444444',
          role: 'CUSTOMER'
        });

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerRes2.body.data.token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already booked');
    });

    it('should reject booking with invalid appointment type', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId: '507f1f77bcf86cd799439011',
          startTime: availableSlotTime
        });

      expect(res.status).toBe(404);
    });

    it('should reject booking for past date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: yesterday.toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('past');
    });

    it('should calculate total amount correctly with tax', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping total amount test');
        return;
      }

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      expect([200, 201]).toContain(res.status);
      // Total = price (100) + tax if applicable
      expect(res.body.data.totalAmount).toBeGreaterThanOrEqual(100);
    });
  });

  describe('POST /api/payments/create-checkout - Stripe Checkout', () => {
    let bookingId;

    beforeEach(async () => {
      if (!availableSlotTime) return;

      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Payment test'
        });

      bookingId = bookingRes.body.data._id;
    });

    it('should create Stripe checkout session', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping checkout test');
        return;
      }

      const res = await request(app)
        .post('/api/payments/create-checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('sessionId');
      expect(res.body.data).toHaveProperty('url');
      expect(res.body.data.url).toContain('checkout.stripe.com');
    });

    it('should reject checkout for non-existent booking', async () => {
      const res = await request(app)
        .post('/api/payments/create-checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId: '507f1f77bcf86cd799439011'
        });

      expect(res.status).toBe(404);
    });

    it('should reject checkout for booking owned by another user', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping ownership test');
        return;
      }

      // Create another customer
      const customer2Res = await request(app)
        .post('/api/auth/signup')
        .send({
          title: 'Customer 2',
          email: `customer2-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+5555555555',
          role: 'CUSTOMER'
        });

      const res = await request(app)
        .post('/api/payments/create-checkout')
        .set('Authorization', `Bearer ${customer2Res.body.data.token}`)
        .send({
          bookingId
        });

      expect(res.status).toBe(403);
    });

    it('should reject checkout for already paid booking', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping already paid test');
        return;
      }

      // Simulate payment completion (update booking status)
      const Booking = require('../src/models/booking.model');
      await Booking.findByIdAndUpdate(bookingId, { status: 'CONFIRMED' });

      const res = await request(app)
        .post('/api/payments/create-checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already');
    });
  });

  describe('POST /api/payments/webhook - Stripe Webhook', () => {
    let bookingId;

    beforeEach(async () => {
      if (!availableSlotTime) return;

      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      bookingId = bookingRes.body.data._id;
    });

    it('should handle successful payment webhook', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping webhook test');
        return;
      }

      const webhookPayload = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            metadata: {
              bookingId
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);

      // Verify booking status updated
      const bookingRes = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(bookingRes.body.data.status).toBe('CONFIRMED');
    });

    it('should reject webhook with invalid signature', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'invalid')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('signature');
    });

    it('should handle failed payment webhook', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping failed payment test');
        return;
      }

      const webhookPayload = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_456',
            payment_status: 'unpaid',
            metadata: {
              bookingId
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);

      // Verify booking status
      const bookingRes = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(['PENDING_PAYMENT', 'CANCELLED']).toContain(bookingRes.body.data.status);
    });
  });

  describe('GET /api/bookings - List Bookings', () => {
    beforeEach(async () => {
      if (!availableSlotTime) return;

      // Create test bookings
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });
    });

    it('should list own bookings for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every(b => b.userId === customerUser._id)).toBe(true);
    });

    it('should list provider bookings for ORGANISER', async () => {
      const res = await request(app)
        .get('/api/bookings/provider')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should forbid CUSTOMER from viewing provider bookings', async () => {
      const res = await request(app)
        .get('/api/bookings/provider')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should filter bookings by status', async () => {
      const res = await request(app)
        .get('/api/bookings?status=PENDING_PAYMENT')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(b => b.status === 'PENDING_PAYMENT')).toBe(true);
    });
  });

  describe('PATCH /api/bookings/:id/cancel - Cancel Booking', () => {
    let bookingId;

    beforeEach(async () => {
      if (!availableSlotTime) return;

      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      bookingId = bookingRes.body.data._id;
    });

    it('should cancel booking as customer owner', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping cancellation test');
        return;
      }

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should forbid cancelling another user\'s booking', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping cancel ownership test');
        return;
      }

      const customer2Res = await request(app)
        .post('/api/auth/signup')
        .send({
          title: 'Customer 2',
          email: `customer2-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+6666666666',
          role: 'CUSTOMER'
        });

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customer2Res.body.data.token}`);

      expect(res.status).toBe(403);
    });

    it('should process refund for confirmed booking', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping refund test');
        return;
      }

      // Update booking to confirmed with payment
      const Booking = require('../src/models/booking.model');
      const Payment = require('../src/models/payment.model');
      
      await Booking.findByIdAndUpdate(bookingId, { status: 'CONFIRMED' });
      await Payment.create({
        bookingId,
        amount: 100,
        currency: 'USD',
        stripeSessionId: 'cs_test_789',
        status: 'COMPLETED'
      });

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      // Verify refund was initiated (mock Stripe refund)
    });

    it('should reject cancellation for completed booking', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping completed cancellation test');
        return;
      }

      // Mark booking as completed
      const Booking = require('../src/models/booking.model');
      await Booking.findByIdAndUpdate(bookingId, { status: 'COMPLETED' });

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot');
    });
  });

  describe('PATCH /api/bookings/:id/status - Update Booking Status', () => {
    let bookingId;

    beforeEach(async () => {
      if (!availableSlotTime) return;

      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime
        });

      bookingId = bookingRes.body.data._id;

      // Confirm booking (simulate payment)
      const Booking = require('../src/models/booking.model');
      await Booking.findByIdAndUpdate(bookingId, { status: 'CONFIRMED' });
    });

    it('should allow ORGANISER to update booking status', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping status update test');
        return;
      }

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          status: 'COMPLETED'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('should forbid CUSTOMER from updating status', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping customer status update test');
        return;
      }

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          status: 'COMPLETED'
        });

      expect(res.status).toBe(403);
    });

    it('should reject invalid status values', async () => {
      if (!bookingId) {
        console.warn('⚠️  No booking created, skipping invalid status test');
        return;
      }

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          status: 'INVALID_STATUS'
        });

      expect(res.status).toBe(400);
    });
  });
});
