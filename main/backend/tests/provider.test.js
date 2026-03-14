/**
 * Provider CRUD Tests
 * Tests: Create, Read, Update, Delete operations with ownership validation
 */

const request = require('supertest');
const app = require('../src/app');

describe('Provider CRUD Operations', () => {
  let organiserToken, organiserUser;
  let adminToken, adminUser;
  let customerToken, customerUser;

  beforeEach(async () => {
    // Create test users
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

    const adminRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Admin',
        email: `admin-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+2222222222',
        role: 'ADMIN'
      });
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    const customerRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Customer',
        email: `customer-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+3333333333',
        role: 'CUSTOMER'
      });
    customerToken = customerRes.body.data.token;
    customerUser = customerRes.body.data.user;
  });

  describe('POST /api/providers - Create Provider', () => {
    it('should create provider with valid data as ORGANISER', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Test Provider',
          description: 'A comprehensive medical provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA'
          },
          website: 'https://provider.com'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('name', 'Test Provider');
      expect(res.body.data).toHaveProperty('userId', organiserUser._id);
      expect(res.body.data).toHaveProperty('isDeleted', false);
    });

    it('should create provider with valid data as ADMIN', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Provider',
          description: 'Provider created by admin',
          contactEmail: 'admin-provider@test.com',
          contactPhone: '+9876543210'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('userId', adminUser._id);
    });

    it('should reject provider creation by CUSTOMER', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Customer Provider',
          description: 'Should fail',
          contactEmail: 'customer-provider@test.com',
          contactPhone: '+1111111111'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject provider creation without authentication', async () => {
      const res = await request(app)
        .post('/api/providers')
        .send({
          name: 'Unauthenticated Provider',
          description: 'Should fail',
          contactEmail: 'unauth@test.com',
          contactPhone: '+2222222222'
        });

      expect(res.status).toBe(401);
    });

    it('should reject provider with missing required fields', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Incomplete Provider'
          // Missing description, contactEmail, contactPhone
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject provider with invalid email format', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Invalid Email Provider',
          description: 'Test',
          contactEmail: 'invalid-email',
          contactPhone: '+1234567890'
        });

      expect(res.status).toBe(400);
    });

    it('should reject provider with duplicate name for same organiser', async () => {
      const providerData = {
        name: 'Duplicate Provider',
        description: 'Test',
        contactEmail: 'duplicate@test.com',
        contactPhone: '+1234567890'
      };

      // Create first provider
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send(providerData);

      // Try to create duplicate
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send(providerData);

      expect(res.status).toBe(409);
    });

    it('should create provider with minimal required fields', async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Minimal Provider',
          description: 'Test',
          contactEmail: 'minimal@test.com',
          contactPhone: '+1234567890'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).not.toHaveProperty('address');
      expect(res.body.data).not.toHaveProperty('website');
    });
  });

  describe('GET /api/providers - List Providers', () => {
    beforeEach(async () => {
      // Create multiple providers
      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Provider 1',
          description: 'Test',
          contactEmail: 'provider1@test.com',
          contactPhone: '+1111111111'
        });

      await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Provider 2',
          description: 'Test',
          contactEmail: 'provider2@test.com',
          contactPhone: '+2222222222'
        });
    });

    it('should list all own providers for ORGANISER', async () => {
      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.every(p => p.userId === organiserUser._id)).toBe(true);
    });

    it('should list all providers for ADMIN', async () => {
      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should forbid CUSTOMER from listing providers', async () => {
      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/providers?page=1&limit=1')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should filter deleted providers by default', async () => {
      // Create and delete a provider
      const createRes = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'To Delete',
          description: 'Test',
          contactEmail: 'todelete@test.com',
          contactPhone: '+3333333333'
        });

      await request(app)
        .delete(`/api/providers/${createRes.body.data._id}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      // List providers
      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      const deleted = res.body.data.find(p => p.name === 'To Delete');
      expect(deleted).toBeUndefined();
    });
  });

  describe('GET /api/providers/:id - Get Provider by ID', () => {
    let providerId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Single Provider',
          description: 'Test',
          contactEmail: 'single@test.com',
          contactPhone: '+1234567890'
        });
      providerId = res.body.data._id;
    });

    it('should get provider details as owner', async () => {
      const res = await request(app)
        .get(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('_id', providerId);
      expect(res.body.data).toHaveProperty('name', 'Single Provider');
    });

    it('should allow ADMIN to get any provider', async () => {
      const res = await request(app)
        .get(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should forbid non-owner ORGANISER from viewing', async () => {
      // Create another organiser
      const otherOrganiserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Other Organiser',
          email: `other-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+4444444444',
          role: 'ORGANISER'
        });

      const res = await request(app)
        .get(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${otherOrganiserRes.body.data.token}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent provider', async () => {
      const res = await request(app)
        .get('/api/providers/507f1f77bcf86cd799439011') // Valid ObjectId format
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid provider ID format', async () => {
      const res = await request(app)
        .get('/api/providers/invalid-id')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/providers/:id - Update Provider', () => {
    let providerId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Provider to Update',
          description: 'Original description',
          contactEmail: 'update@test.com',
          contactPhone: '+1234567890'
        });
      providerId = res.body.data._id;
    });

    it('should update provider as owner', async () => {
      const res = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Updated Provider',
          description: 'Updated description'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('name', 'Updated Provider');
      expect(res.body.data).toHaveProperty('description', 'Updated description');
    });

    it('should allow ADMIN to update any provider', async () => {
      const res = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('name', 'Admin Updated');
    });

    it('should forbid non-owner ORGANISER from updating', async () => {
      const otherOrganiserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Other Organiser',
          email: `other-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+5555555555',
          role: 'ORGANISER'
        });

      const res = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${otherOrganiserRes.body.data.token}`)
        .send({
          name: 'Hijacked'
        });

      expect(res.status).toBe(403);
    });

    it('should update only provided fields (partial update)', async () => {
      const res = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          description: 'Only description changed'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('name', 'Provider to Update'); // Unchanged
      expect(res.body.data).toHaveProperty('description', 'Only description changed');
    });

    it('should reject invalid email format in update', async () => {
      const res = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          contactEmail: 'invalid-email'
        });

      expect(res.status).toBe(400);
    });

    it('should not allow updating userId', async () => {
      const res = await request(app)
        .put(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          userId: 'fake-user-id'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('userId', organiserUser._id); // Unchanged
    });
  });

  describe('DELETE /api/providers/:id - Soft Delete Provider', () => {
    let providerId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          name: 'Provider to Delete',
          description: 'Test',
          contactEmail: 'delete@test.com',
          contactPhone: '+1234567890'
        });
      providerId = res.body.data._id;
    });

    it('should soft delete provider as owner', async () => {
      const res = await request(app)
        .delete(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');

      // Verify soft delete (isDeleted = true)
      const getRes = await request(app)
        .get(`/api/providers/${providerId}?includeDeleted=true`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data).toHaveProperty('isDeleted', true);
    });

    it('should allow ADMIN to delete any provider', async () => {
      const res = await request(app)
        .delete(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should forbid non-owner ORGANISER from deleting', async () => {
      const otherOrganiserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Other Organiser',
          email: `other-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+6666666666',
          role: 'ORGANISER'
        });

      const res = await request(app)
        .delete(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${otherOrganiserRes.body.data.token}`);

      expect(res.status).toBe(403);
    });

    it('should hide deleted provider from list by default', async () => {
      await request(app)
        .delete(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      const res = await request(app)
        .get('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`);

      const deleted = res.body.data.find(p => p._id === providerId);
      expect(deleted).toBeUndefined();
    });

    it('should return 404 when deleting already deleted provider', async () => {
      // Delete once
      await request(app)
        .delete(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      // Try to delete again
      const res = await request(app)
        .delete(`/api/providers/${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(404);
    });
  });
});
