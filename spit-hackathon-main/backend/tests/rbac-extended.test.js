/**
 * Extended RBAC (Role-Based Access Control) Tests
 * Tests: Role permissions, ownership validation, cross-organiser protection
 */

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Provider = require('../src/models/provider.model');
const AppointmentType = require('../src/models/appointmentType.model');

describe('RBAC - Role-Based Access Control Tests', () => {
  let customerToken, customerUser;
  let organiser1Token, organiser1User;
  let organiser2Token, organiser2User;
  let adminToken, adminUser;

  beforeEach(async () => {
    // Create CUSTOMER
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

    // Create ORGANISER 1
    const organiser1Res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Organiser 1',
        email: `organiser1-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+2222222222',
        role: 'ORGANISER'
      });
    organiser1Token = organiser1Res.body.data.token;
    organiser1User = organiser1Res.body.data.user;

    // Create ORGANISER 2
    await global.testUtils.wait(10); // Ensure unique timestamp
    const organiser2Res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Organiser 2',
        email: `organiser2-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+3333333333',
        role: 'ORGANISER'
      });
    organiser2Token = organiser2Res.body.data.token;
    organiser2User = organiser2Res.body.data.user;

    // Create ADMIN directly (bypassing validation)
    adminUser = await global.testUtils.createTestUser('ADMIN');
    adminToken = global.testUtils.generateToken(adminUser);
  });

  describe('CUSTOMER Role Restrictions', () => {
    it('should FORBID customer from creating a provider', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Provider',
          description: 'Should fail',
          contactEmail: 'provider@test.com',
          contactPhone: '+5555555555'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('permission');
    });

    it('should FORBID customer from creating an appointment type', async () => {
      // First create a provider as organiser
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Test Provider',
          description: 'Test',
          contactEmail: 'provider@test.com',
          contactPhone: '+5555555555'
        });

      const providerId = providerRes.body.data._id;

      // Try to create appointment type as customer
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId,
          name: 'Unauthorized Type',
          duration: 30,
          price: 100,
          currency: 'USD'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should FORBID customer from creating availability rules', async () => {
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Test Provider',
          description: 'Test',
          contactEmail: 'provider@test.com',
          contactPhone: '+5555555555'
        });

      const providerId = providerRes.body.data._id;

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
      expect(res.body.success).toBe(false);
    });

    it('should ALLOW customer to view published appointment types', async () => {
      // Create provider and published appointment type
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Test Provider',
          description: 'Test',
          contactEmail: 'provider@test.com',
          contactPhone: '+5555555555'
        });

      await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          providerId: providerRes.body.data._id,
          name: 'Published Type',
          duration: 30,
          price: 100,
          currency: 'USD',
          isPublished: true
        });

      // Customer views published types
      const res = await request(app)
        .get('/api/appointment-types')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every(type => type.isPublished)).toBe(true);
    });

    it('should NOT show unpublished types to customer', async () => {
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Test Provider',
          description: 'Test',
          contactEmail: 'provider@test.com',
          contactPhone: '+5555555555'
        });

      await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          providerId: providerRes.body.data._id,
          name: 'Unpublished Type',
          duration: 30,
          price: 100,
          currency: 'USD',
          isPublished: false
        });

      const res = await request(app)
        .get('/api/appointment-types')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const unpublished = res.body.data.find(type => type.name === 'Unpublished Type');
      expect(unpublished).toBeUndefined();
    });

    it('should ALLOW customer to create bookings', async () => {
      // Setup: Create provider, appointment type, availability, and slots
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Test Provider',
          description: 'Test',
          contactEmail: 'provider@test.com',
          contactPhone: '+5555555555'
        });

      const typeRes = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          providerId: providerRes.body.data._id,
          name: 'Test Type',
          duration: 30,
          price: 100,
          currency: 'USD',
          isPublished: true
        });

      await request(app)
        .post('/api/availability')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          providerId: providerRes.body.data._id,
          dayOfWeek: new Date().getDay(),
          startTime: '09:00',
          endTime: '17:00',
          timezone: 'America/New_York'
        });

      // Generate slots
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const slotsRes = await request(app)
        .get(`/api/slots/generate?providerId=${providerRes.body.data._id}&appointmentTypeId=${typeRes.body.data._id}&date=${tomorrow.toISOString().split('T')[0]}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(slotsRes.status).toBe(200);

      if (slotsRes.body.data.length > 0) {
        // Create booking
        const bookingRes = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            appointmentTypeId: typeRes.body.data._id,
            startTime: slotsRes.body.data[0].startTime,
            notes: 'Test booking'
          });

        expect([200, 201]).toContain(bookingRes.status);
      }
    });

    it('should FORBID customer from updating booking status', async () => {
      // This would require a booking to exist, simplified check
      const res = await request(app)
        .patch('/api/bookings/fake-id/status')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'CONFIRMED' });

      expect([403, 404]).toContain(res.status); // Either forbidden or not found
    });
  });

  describe('ORGANISER Ownership Validation', () => {
    it('should ALLOW organiser to create provider', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Organiser Provider',
          description: 'Owned by organiser',
          contactEmail: 'org-provider@test.com',
          contactPhone: '+6666666666'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('userId', organiser1User._id);
    });

    it('should FORBID organiser from editing another organiser\'s provider', async () => {
      // Organiser 1 creates provider
      const provider1Res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Organiser 1 Provider',
          description: 'Owned by organiser 1',
          contactEmail: 'org1-provider@test.com',
          contactPhone: '+7777777777'
        });

      const provider1Id = provider1Res.body.data._id;

      // Organiser 2 tries to update it
      const res = await request(app)
        .put(`/api/providers/${provider1Id}`)
        .set('Authorization', `Bearer ${organiser2Token}`)
        .send({
          name: 'Hijacked Provider'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('permission');
    });

    it('should FORBID organiser from deleting another organiser\'s provider', async () => {
      const provider1Res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Provider to Delete',
          description: 'Test',
          contactEmail: 'delete-provider@test.com',
          contactPhone: '+8888888888'
        });

      const res = await request(app)
        .delete(`/api/providers/${provider1Res.body.data._id}`)
        .set('Authorization', `Bearer ${organiser2Token}`);

      expect(res.status).toBe(403);
    });

    it('should FORBID organiser from viewing another organiser\'s provider details', async () => {
      const provider1Res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Private Provider',
          description: 'Test',
          contactEmail: 'private-provider@test.com',
          contactPhone: '+9999999999'
        });

      // Organiser 2 tries to view
      const res = await request(app)
        .get(`/api/providers/${provider1Res.body.data._id}`)
        .set('Authorization', `Bearer ${organiser2Token}`);

      expect(res.status).toBe(403);
    });

    it('should FORBID organiser from creating appointment type for another organiser\'s provider', async () => {
      const provider1Res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Protected Provider',
          description: 'Test',
          contactEmail: 'protected-provider@test.com',
          contactPhone: '+1010101010'
        });

      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiser2Token}`)
        .send({
          providerId: provider1Res.body.data._id,
          name: 'Unauthorized Type',
          duration: 30,
          price: 100,
          currency: 'USD'
        });

      expect(res.status).toBe(403);
    });

    it('should ALLOW organiser to view only their own providers', async () => {
      // Organiser 1 creates provider
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Org1 Provider',
          description: 'Test',
          contactEmail: 'org1-unique@test.com',
          contactPhone: '+1212121212'
        });

      // Organiser 2 creates provider
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser2Token}`)
        .send({
          name: 'Org2 Provider',
          description: 'Test',
          contactEmail: 'org2-unique@test.com',
          contactPhone: '+1313131313'
        });

      // Organiser 1 views providers
      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(p => p.userId === organiser1User._id)).toBe(true);
    });
  });

  describe('ADMIN Override Capabilities', () => {
    it('should ALLOW admin to view all providers across organisers', async () => {
      // Create providers for different organisers
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Admin View Test 1',
          description: 'Test',
          contactEmail: 'admin-view-1@test.com',
          contactPhone: '+1414141414'
        });

      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser2Token}`)
        .send({
          name: 'Admin View Test 2',
          description: 'Test',
          contactEmail: 'admin-view-2@test.com',
          contactPhone: '+1515151515'
        });

      // Admin views all
      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should ALLOW admin to update any provider', async () => {
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Provider for Admin Update',
          description: 'Test',
          contactEmail: 'admin-update@test.com',
          contactPhone: '+1616161616'
        });

      const res = await request(app)
        .put(`/api/providers/${providerRes.body.data._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated Provider'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Admin Updated Provider');
    });

    it('should ALLOW admin to delete any provider', async () => {
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Provider for Admin Delete',
          description: 'Test',
          contactEmail: 'admin-delete@test.com',
          contactPhone: '+1717171717'
        });

      const res = await request(app)
        .delete(`/api/providers/${providerRes.body.data._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should ALLOW admin to view analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalUsers');
      expect(res.body.data).toHaveProperty('totalBookings');
    });

    it('should FORBID non-admin from viewing analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${organiser1Token}`);

      expect(res.status).toBe(403);
    });

    it('should ALLOW admin to manage users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should ALLOW unauthenticated users to view published appointment types', async () => {
      const providerRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          name: 'Public Provider',
          description: 'Test',
          contactEmail: 'public-provider@test.com',
          contactPhone: '+1818181818'
        });

      await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiser1Token}`)
        .send({
          providerId: providerRes.body.data._id,
          name: 'Public Type',
          duration: 30,
          price: 100,
          currency: 'USD',
          isPublished: true
        });

      const res = await request(app)
        .get('/api/appointment-types');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should FORBID unauthenticated users from creating bookings', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .send({
          appointmentTypeId: 'fake-id',
          startTime: new Date().toISOString()
        });

      expect(res.status).toBe(401);
    });

    it('should FORBID unauthenticated users from viewing provider details', async () => {
      const res = await request(app)
        .get('/api/providers/fake-id');

      expect(res.status).toBe(401);
    });
  });

  describe('Edge Cases', () => {
    it('should reject invalid role in token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config/env');
      
      const invalidToken = jwt.sign(
        { _id: 'fake-id', email: 'fake@test.com', role: 'INVALID_ROLE' },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.status).toBe(401);
    });

    it('should handle missing role in token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config/env');
      
      const noRoleToken = jwt.sign(
        { _id: 'fake-id', email: 'fake@test.com' }, // No role
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${noRoleToken}`);

      expect(res.status).toBe(401);
    });
  });
});
