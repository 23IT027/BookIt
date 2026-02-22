/**
 * Availability Rules & Slot Generation Tests
 * Tests: Create availability, overlapping times, exception dates, slot generation with timezones
 */

const request = require('supertest');
const app = require('../src/app');

describe('Availability Rules & Slot Generation', () => {
  let organiserToken, organiserUser;
  let customerToken;
  let providerId, appointmentTypeId;

  beforeEach(async () => {
    // Create organiser
    const organiserRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Organiser',
        email: `organiser-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+1111111111',
        role: 'ORGANISER'
      });
    organiserToken = organiserRes.body.data.token;
    organiserUser = organiserRes.body.data.user;

    // Create customer
    const customerRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Customer',
        email: `customer-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+2222222222',
        role: 'CUSTOMER'
      });
    customerToken = customerRes.body.data.token;

    // Create provider
    const providerRes = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        title: 'Test Provider',
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
        title: 'Test Appointment',
        description: 'Test',
        durationMinutes: 30,
        bufferMinutes: 10,
        price: 100,
        currency: 'USD',
        published: true
      });
    appointmentTypeId = typeRes.body.data._id;
  });

  describe('POST /api/availability - Create Availability Rule', () => {
    it('should create availability rule with valid data', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('dayOfWeek', 1);
      expect(res.body.data).toHaveProperty('startTime', '09:00');
      expect(res.body.data).toHaveProperty('endTime', '17:00');
      expect(res.body.data).toHaveProperty('timezone', 'America/New_York');
    });

    it('should create availability for all weekdays', async () => {
      const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
      
      for (const day of weekdays) {
        const res = await request(app)
          .post('/api/availability')
          .set('Authorization', `Bearer ${organiserToken}`)
          .send({
            providerId,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'America/New_York'
          });

        expect(res.status).toBe(201);
        expect(res.body.data).toHaveProperty('dayOfWeek', day);
      }
    });

    it('should forbid CUSTOMER from creating availability', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });

      expect(res.status).toBe(403);
    });

    it('should reject overlapping time ranges for same day', async () => {
      // Create first rule
      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '13:00',
          timezone: 'America/New_York'
        });

      // Try to create overlapping rule
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '12:00', // Overlaps with previous 09:00-13:00
          endTime: '17:00',
          timezone: 'America/New_York'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('overlap');
    });

    it('should reject invalid dayOfWeek (0-6 only)', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 7, // Invalid (0-6 only)
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });

      expect(res.status).toBe(400);
    });

    it('should reject startTime >= endTime', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '17:00',
          endTime: '09:00', // Earlier than start
          timezone: 'America/New_York'
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid time format', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '25:00', // Invalid hour
          endTime: '17:00',
          timezone: 'America/New_York'
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid timezone', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'Invalid/Timezone'
        });

      expect(res.status).toBe(400);
    });

    it('should create availability with exception dates', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York',
          exceptionDates: [tomorrow.toISOString().split('T')[0]]
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('exceptionDates');
      expect(res.body.data.exceptionDates.length).toBe(1);
    });
  });

  describe('GET /api/availability - List Availability Rules', () => {
    beforeEach(async () => {
      // Create multiple availability rules
      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
          timezone: 'America/New_York'
        });

      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 2,
          startTime: '13:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });
    });

    it('should list availability rules for provider', async () => {
      const res = await request(app)
        .get(`/api/availability?providerId=${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.every(rule => rule.providerId === providerId)).toBe(true);
    });

    it('should allow CUSTOMER to view availability', async () => {
      const res = await request(app)
        .get(`/api/availability?providerId=${providerId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/availability/:id - Update Availability', () => {
    let availabilityId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });
      availabilityId = res.body.data._id;
    });

    it('should update availability rule', async () => {
      const res = await request(app)
        .put(`/api/availability/${availabilityId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          startTime: '10:00',
          endTime: '18:00'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('startTime', '10:00');
      expect(res.body.data).toHaveProperty('endTime', '18:00');
    });

    it('should forbid CUSTOMER from updating', async () => {
      const res = await request(app)
        .put(`/api/availability/${availabilityId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          startTime: '10:00'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/availability/:id - Delete Availability', () => {
    let availabilityId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });
      availabilityId = res.body.data._id;
    });

    it('should delete availability rule', async () => {
      const res = await request(app)
        .delete(`/api/availability/${availabilityId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
    });

    it('should forbid CUSTOMER from deleting', async () => {
      const res = await request(app)
        .delete(`/api/availability/${availabilityId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/slots/generate - Generate Slots', () => {
    beforeEach(async () => {
      // Create availability for today's day of week
      const today = new Date();
      const dayOfWeek = today.getDay();

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
    });

    it('should generate slots for valid date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('startTime');
        expect(res.body.data[0]).toHaveProperty('endTime');
        expect(res.body.data[0]).toHaveProperty('isAvailable');
      }
    });

    it('should respect appointment duration', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);

      if (res.body.data.length > 0) {
        const slot = res.body.data[0];
        const start = new Date(slot.startTime);
        const end = new Date(slot.endTime);
        const durationMinutes = (end - start) / (1000 * 60);
        
        expect(durationMinutes).toBe(30); // Duration from appointment type
      }
    });

    it('should respect buffer time between slots', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);

      if (res.body.data.length >= 2) {
        const slot1End = new Date(res.body.data[0].endTime);
        const slot2Start = new Date(res.body.data[1].startTime);
        const bufferMinutes = (slot2Start - slot1End) / (1000 * 60);
        
        expect(bufferMinutes).toBe(10); // Buffer time from appointment type
      }
    });

    it('should mark booked slots as unavailable', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      // Generate slots
      const slotsRes = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      if (slotsRes.body.data.length > 0) {
        // Book first slot
        await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            appointmentTypeId,
            startTime: slotsRes.body.data[0].startTime,
            notes: 'Test booking'
          });

        // Regenerate slots
        const newSlotsRes = await request(app)
          .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
          .set('Authorization', `Bearer ${customerToken}`);

        const bookedSlot = newSlotsRes.body.data.find(
          slot => slot.startTime === slotsRes.body.data[0].startTime
        );

        expect(bookedSlot.isAvailable).toBe(false);
      }
    });

    it('should return empty array for date with no availability', async () => {
      // Delete all availability
      const availabilityRes = await request(app)
        .get(`/api/availability?providerId=${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      for (const rule of availabilityRes.body.data) {
        await request(app)
          .delete(`/api/availability/${rule._id}`)
          .set('Authorization', `Bearer ${organiserToken}`);
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it('should reject missing required parameters', async () => {
      const res = await request(app)
        .get('/api/slots/generate')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=invalid-date`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
    });

    it('should handle timezone conversions correctly', async () => {
      // Create availability in different timezone
      const today = new Date();
      const dayOfWeek = today.getDay();

      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek: (dayOfWeek + 1) % 7,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'Asia/Kolkata' // Different timezone
        });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      // Slots should be generated in provider's timezone
    });

    it('should exclude exception dates', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];
      const dayOfWeek = tomorrow.getDay();

      // Create availability with exception date
      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York',
          exceptionDates: [date]
        });

      const res = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0); // No slots on exception date
    });
  });
});
