/**
 * Appointment Type CRUD Tests
 * Tests: Create, Read, Update, Delete with Cloudinary mocks, published/unpublished filtering
 */

const request = require('supertest');
const app = require('../src/app');
const cloudinaryService = require('../src/services/cloudinary.service');

describe('Appointment Type CRUD Operations', () => {
  let organiserToken, organiserUser;
  let customerToken;
  let providerId;

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
  });

  describe('POST /api/appointment-types - Create Appointment Type', () => {
    it('should create appointment type with valid data', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'General Consultation',
          description: '30-minute consultation',
          durationMinutes: 30,
          price: 100.00,
          currency: 'USD',
          published: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('title', 'General Consultation');
      expect(res.body.data).toHaveProperty('durationMinutes', 30);
      expect(res.body.data).toHaveProperty('price', 100.00);
      expect(res.body.data).toHaveProperty('published', true);
    });

    it('should create appointment type with image upload (Cloudinary mock)', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .field('providerId', providerId)
        .field('title', 'Type with Image')
        .field('description', 'Test')
        .field('durationMinutes', 30)
        .field('price', 100)
        .field('currency', 'USD')
        .attach('image', Buffer.from('fake-image-data'), 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('imageUrl');
      expect(res.body.data.imageUrl).toContain('cloudinary.com');
      expect(cloudinaryService.uploadImage).toHaveBeenCalled();
    });

    it('should create appointment type with buffer time', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Type with Buffer',
          description: 'Test',
          durationMinutes: 30,
          bufferMinutes: 15,
          price: 100,
          currency: 'USD'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('bufferMinutes', 15);
    });

    it('should forbid CUSTOMER from creating appointment type', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId,
          title: 'Customer Type',
          description: 'Should fail',
          durationMinutes: 30,
          price: 100,
          currency: 'USD'
        });

      expect(res.status).toBe(403);
    });

    it('should reject invalid providerId', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId: '507f1f77bcf86cd799439011', // Non-existent
          title: 'Invalid Provider',
          description: 'Test',
          durationMinutes: 30,
          price: 100,
          currency: 'USD'
        });

      expect(res.status).toBe(404);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Incomplete Type'
          // Missing duration, price, currency
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid duration (zero or negative)', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Invalid Duration',
          description: 'Test',
          duration: -10,
          price: 100,
          currency: 'USD'
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid price (negative)', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Invalid Price',
          description: 'Test',
          durationMinutes: 30,
          price: -50,
          currency: 'USD'
        });

      expect(res.status).toBe(400);
    });

    it('should default isPublished to false', async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Unpublished Type',
          description: 'Test',
          durationMinutes: 30,
          price: 100,
          currency: 'USD'
          // No isPublished field
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('published', false);
    });
  });

  describe('GET /api/appointment-types - List Appointment Types', () => {
    beforeEach(async () => {
      // Create published type
      await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Published Type',
          description: 'Test',
          durationMinutes: 30,
          price: 100,
          currency: 'USD',
          published: true
        });

      // Create unpublished type
      await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Unpublished Type',
          description: 'Test',
          durationMinutes: 45,
          price: 150,
          currency: 'USD',
          published: false
        });
    });

    it('should show only published types to CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/appointment-types')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every(type => type.published)).toBe(true);
    });

    it('should show only published types to unauthenticated users', async () => {
      const res = await request(app)
        .get('/api/appointment-types');

      expect(res.status).toBe(200);
      expect(res.body.data.every(type => type.published)).toBe(true);
    });

    it('should show all types (published + unpublished) to ORGANISER', async () => {
      const res = await request(app)
        .get('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      const published = res.body.data.filter(t => t.published);
      const unpublished = res.body.data.filter(t => !t.published);
      expect(published.length).toBeGreaterThan(0);
      expect(unpublished.length).toBeGreaterThan(0);
    });

    it('should filter by providerId', async () => {
      const res = await request(app)
        .get(`/api/appointment-types?providerId=${providerId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(type => type.providerId === providerId)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/appointment-types?page=1&limit=1')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/appointment-types/:id - Get Single Type', () => {
    let typeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Single Type',
          description: 'Test',
          durationMinutes: 30,
          price: 100,
          currency: 'USD',
          published: true
        });
      typeId = res.body.data._id;
    });

    it('should get appointment type by ID', async () => {
      const res = await request(app)
        .get(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('_id', typeId);
      expect(res.body.data).toHaveProperty('title', 'Single Type');
    });

    it('should allow CUSTOMER to view published type', async () => {
      const res = await request(app)
        .get(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
    });

    it('should forbid CUSTOMER from viewing unpublished type', async () => {
      // Create unpublished type
      const unpublishedRes = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Unpublished',
          description: 'Test',
          durationMinutes: 30,
          price: 100,
          currency: 'USD',
          published: false
        });

      const res = await request(app)
        .get(`/api/appointment-types/${unpublishedRes.body.data._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent type', async () => {
      const res = await request(app)
        .get('/api/appointment-types/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/appointment-types/:id - Update Type', () => {
    let typeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Type to Update',
          description: 'Original',
          durationMinutes: 30,
          price: 100,
          currency: 'USD'
        });
      typeId = res.body.data._id;
    });

    it('should update appointment type as owner', async () => {
      const res = await request(app)
        .put(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          title: 'Updated Type',
          price: 150
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('title', 'Updated Type');
      expect(res.body.data).toHaveProperty('price', 150);
    });

    it('should update image (Cloudinary mock)', async () => {
      const res = await request(app)
        .put(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .attach('image', Buffer.from('new-image-data'), 'new.jpg');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('imageUrl');
      expect(cloudinaryService.uploadImage).toHaveBeenCalled();
    });

    it('should forbid CUSTOMER from updating', async () => {
      const res = await request(app)
        .put(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Hijacked'
        });

      expect(res.status).toBe(403);
    });

    it('should forbid non-owner ORGANISER from updating', async () => {
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
        .put(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${otherOrganiserRes.body.data.token}`)
        .send({
          title: 'Hijacked'
        });

      expect(res.status).toBe(403);
    });

    it('should toggle isPublished', async () => {
      const res = await request(app)
        .put(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          published: true
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('published', true);
    });
  });

  describe('DELETE /api/appointment-types/:id - Delete Type', () => {
    let typeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          providerId,
          title: 'Type to Delete',
          description: 'Test',
          durationMinutes: 30,
          price: 100,
          currency: 'USD'
        });
      typeId = res.body.data._id;
    });

    it('should soft delete appointment type as owner', async () => {
      const res = await request(app)
        .delete(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('should delete image from Cloudinary when deleting type', async () => {
      // Create type with image
      const typeWithImageRes = await request(app)
        .post('/api/appointment-types')
        .set('Authorization', `Bearer ${organiserToken}`)
        .field('providerId', providerId)
        .field('title', 'Type with Image')
        .field('description', 'Test')
        .field('durationMinutes', 30)
        .field('price', 100)
        .field('currency', 'USD')
        .attach('image', Buffer.from('image-data'), 'test.jpg');

      const imageTypeId = typeWithImageRes.body.data._id;

      const res = await request(app)
        .delete(`/api/appointment-types/${imageTypeId}`)
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(200);
      expect(cloudinaryService.deleteImage).toHaveBeenCalled();
    });

    it('should forbid CUSTOMER from deleting', async () => {
      const res = await request(app)
        .delete(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should forbid non-owner ORGANISER from deleting', async () => {
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
        .delete(`/api/appointment-types/${typeId}`)
        .set('Authorization', `Bearer ${otherOrganiserRes.body.data.token}`);

      expect(res.status).toBe(403);
    });
  });
});
