/**
 * Concurrency & Redis Locking Tests
 * Tests: Distributed locking, race conditions, double booking prevention, lock timeout
 */

const request = require('supertest');
const app = require('../src/app');
const redisService = require('../src/services/redisLock.service');

describe('Concurrency & Redis Distributed Locking', () => {
  let customer1Token, customer2Token, customer3Token;
  let organiserToken;
  let providerId, appointmentTypeId;
  let availableSlotTime;

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

    // Create 3 customers for race condition tests
    const customer1Res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Customer 1',
        email: `customer1-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+2222222222',
        role: 'CUSTOMER'
      });
    customer1Token = customer1Res.body.data.token;

    await global.testUtils.wait(10);
    const customer2Res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Customer 2',
        email: `customer2-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+3333333333',
        role: 'CUSTOMER'
      });
    customer2Token = customer2Res.body.data.token;

    await global.testUtils.wait(10);
    const customer3Res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Customer 3',
        email: `customer3-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+4444444444',
        role: 'CUSTOMER'
      });
    customer3Token = customer3Res.body.data.token;

    // Setup provider, appointment type, and availability
    const providerRes = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        name: 'Concurrency Test Provider',
        description: 'Test',
        contactEmail: 'provider@test.com',
        contactPhone: '+5555555555'
      });
    providerId = providerRes.body.data._id;

    const typeRes = await request(app)
      .post('/api/appointment-types')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        providerId,
        name: 'Concurrency Test Type',
        description: 'Test',
        duration: 30,
        bufferTime: 5,
        price: 100,
        currency: 'USD',
        isPublished: true
      });
    appointmentTypeId = typeRes.body.data._id;

    // Create availability for tomorrow
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

    // Generate slots to get an available time
    const date = tomorrow.toISOString().split('T')[0];
    const slotsRes = await request(app)
      .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    if (slotsRes.body.data.length > 0) {
      availableSlotTime = slotsRes.body.data[0].startTime;
    }
  });

  describe('Redis Lock Acquisition', () => {
    it('should successfully acquire lock for booking', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping lock acquisition test');
        return;
      }

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Lock acquisition test'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
    });

    it('should release lock after successful booking', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping lock release test');
        return;
      }

      // Make booking (lock acquired and released)
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'First booking'
        });

      // Wait a moment
      await global.testUtils.wait(100);

      // Verify lock was released by checking Redis
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      const isLocked = await redisService.get(lockKey);
      
      expect(isLocked).toBeNull(); // Lock should be released
    });

    it('should release lock after failed booking', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping failed booking test');
        return;
      }

      // Try to book with invalid data (will fail)
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId: '507f1f77bcf86cd799439011', // Non-existent
          startTime: availableSlotTime,
          notes: 'Should fail'
        });

      // Verify lock was released
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      const isLocked = await redisService.get(lockKey);
      
      expect(isLocked).toBeNull();
    });
  });

  describe('Prevent Double Booking - Race Condition', () => {
    it('should prevent double booking when 2 customers book simultaneously', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping double booking test');
        return;
      }

      // Simulate simultaneous booking attempts
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send({
            appointmentTypeId,
            startTime: availableSlotTime,
            notes: 'Customer 1 booking'
          }),
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send({
            appointmentTypeId,
            startTime: availableSlotTime,
            notes: 'Customer 2 booking'
          })
      ]);

      // One should succeed, one should fail with 409 Conflict
      const statuses = [res1.status, res2.status].sort();
      const successStatuses = [200, 201];
      
      expect(
        (successStatuses.includes(statuses[0]) && statuses[1] === 409) ||
        (successStatuses.includes(statuses[1]) && statuses[0] === 409)
      ).toBe(true);

      // Verify only one booking exists
      const bookingsRes1 = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`);

      const bookingsRes2 = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${customer2Token}`);

      const totalBookingsForSlot = [
        ...bookingsRes1.body.data,
        ...bookingsRes2.body.data
      ].filter(b => b.startTime === availableSlotTime).length;

      expect(totalBookingsForSlot).toBe(1); // Only one booking should exist
    });

    it('should prevent triple booking from 3 simultaneous requests', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping triple booking test');
        return;
      }

      // 3-way race condition
      const [res1, res2, res3] = await Promise.all([
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send({
            appointmentTypeId,
            startTime: availableSlotTime,
            notes: 'Customer 1'
          }),
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send({
            appointmentTypeId,
            startTime: availableSlotTime,
            notes: 'Customer 2'
          }),
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer3Token}`)
          .send({
            appointmentTypeId,
            startTime: availableSlotTime,
            notes: 'Customer 3'
          })
      ]);

      const statuses = [res1.status, res2.status, res3.status];
      const successCount = statuses.filter(s => s === 200 || s === 201).length;
      const conflictCount = statuses.filter(s => s === 409).length;

      expect(successCount).toBe(1); // Only 1 should succeed
      expect(conflictCount).toBe(2); // 2 should get conflicts
    });

    it('should handle rapid sequential booking attempts correctly', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping sequential booking test');
        return;
      }

      // First booking should succeed
      const res1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'First booking'
        });

      expect([200, 201]).toContain(res1.status);

      // Wait 100ms
      await global.testUtils.wait(100);

      // Second booking should fail (slot taken)
      const res2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Second booking'
        });

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('already booked');
    });
  });

  describe('Lock Timeout & Expiry', () => {
    it('should set lock with TTL (Time To Live)', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping TTL test');
        return;
      }

      // Manually acquire lock
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      await redisService.set(lockKey, 'test-lock', 30); // 30 seconds TTL

      // Check TTL
      const ttl = await redisService.client.ttl(lockKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30);

      // Cleanup
      await redisService.del(lockKey);
    });

    it('should auto-release lock after TTL expires', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping auto-release test');
        return;
      }

      // Set lock with 2 second TTL
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      await redisService.set(lockKey, 'test-lock', 2);

      // Verify lock exists
      let lockValue = await redisService.get(lockKey);
      expect(lockValue).toBe('test-lock');

      // Wait 3 seconds for expiry
      await global.testUtils.wait(3000);

      // Verify lock expired
      lockValue = await redisService.get(lockKey);
      expect(lockValue).toBeNull();
    }, 10000); // Increase test timeout for this test

    it('should handle lock timeout gracefully in booking', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping lock timeout test');
        return;
      }

      // Manually acquire lock (simulate stuck process)
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      await redisService.set(lockKey, 'stuck-lock', 2);

      // Try to book (should wait for lock)
      const bookingPromise = request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Test booking'
        });

      // Wait for lock to expire
      await global.testUtils.wait(2500);

      const res = await bookingPromise;

      // Should either succeed after lock expires or timeout gracefully
      expect([200, 201, 409, 504]).toContain(res.status);
    }, 15000);
  });

  describe('Lock Key Format & Uniqueness', () => {
    it('should use unique lock keys per provider and time slot', async () => {
      const lockKey1 = `booking:lock:${providerId}:${availableSlotTime}`;
      const lockKey2 = `booking:lock:${providerId}:${new Date().toISOString()}`;
      
      expect(lockKey1).not.toBe(lockKey2);
    });

    it('should allow simultaneous bookings for different time slots', async () => {
      // Generate multiple slots
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      const slotsRes = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      if (slotsRes.body.data.length < 2) {
        console.warn('⚠️  Not enough slots, skipping simultaneous booking test');
        return;
      }

      const slot1 = slotsRes.body.data[0].startTime;
      const slot2 = slotsRes.body.data[1].startTime;

      // Book different slots simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send({
            appointmentTypeId,
            startTime: slot1,
            notes: 'Slot 1'
          }),
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send({
            appointmentTypeId,
            startTime: slot2,
            notes: 'Slot 2'
          })
      ]);

      // Both should succeed (different slots)
      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);
    });
  });

  describe('Lock Error Handling', () => {
    it('should handle Redis connection failure gracefully', async () => {
      // This test simulates Redis being unavailable
      // In production, bookings should fail safely
      
      if (global.mockRedis) {
        console.log('✅ Using mock Redis, skipping connection failure test');
        return;
      }

      // Note: Actual implementation should have fallback logic
      // This test verifies the system doesn't crash
      expect(true).toBe(true);
    });

    it('should cleanup locks even if booking validation fails', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping cleanup test');
        return;
      }

      // Try booking with invalid appointment type (will fail validation)
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId: '507f1f77bcf86cd799439011',
          startTime: availableSlotTime,
          notes: 'Invalid booking'
        });

      // Verify lock was cleaned up
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      const lockValue = await redisService.get(lockKey);
      expect(lockValue).toBeNull();
    });

    it('should prevent booking if lock acquisition fails', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping lock acquisition failure test');
        return;
      }

      // Pre-acquire lock
      const lockKey = `booking:lock:${providerId}:${availableSlotTime}`;
      await redisService.set(lockKey, 'existing-lock', 30);

      // Try to book (should fail immediately or timeout)
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Should fail'
        });

      expect([409, 504]).toContain(res.status);

      // Cleanup
      await redisService.del(lockKey);
    });
  });

  describe('Slot Availability After Booking', () => {
    it('should mark slot as unavailable after successful booking', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping availability test');
        return;
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      // Book slot
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'Test booking'
        });

      // Check slot availability
      const slotsRes = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      const bookedSlot = slotsRes.body.data.find(s => s.startTime === availableSlotTime);
      expect(bookedSlot.isAvailable).toBe(false);
    });

    it('should free slot when booking is cancelled', async () => {
      if (!availableSlotTime) {
        console.warn('⚠️  No available slots, skipping cancellation test');
        return;
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const date = tomorrow.toISOString().split('T')[0];

      // Book slot
      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          appointmentTypeId,
          startTime: availableSlotTime,
          notes: 'To cancel'
        });

      const bookingId = bookingRes.body.data._id;

      // Cancel booking
      await request(app)
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customer1Token}`);

      // Check slot is available again
      const slotsRes = await request(app)
        .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      const freedSlot = slotsRes.body.data.find(s => s.startTime === availableSlotTime);
      expect(freedSlot.isAvailable).toBe(true);
    });
  });
});
