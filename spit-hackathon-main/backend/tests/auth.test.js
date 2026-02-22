/**
 * Authentication Tests
 * Tests: Signup, Login, Protected Routes, Token Validation
 */

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');

describe('Authentication API Tests', () => {
  describe('POST /api/auth/signup', () => {
    it('should register a new CUSTOMER with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'John Customer',
          email: 'customer@test.com',
          password: 'Password123!',
          phone: '+1234567890',
          role: 'CUSTOMER'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('email', 'customer@test.com');
      expect(res.body.data.user).toHaveProperty('role', 'CUSTOMER');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should register a new ORGANISER with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Jane Organiser',
          email: 'organiser@test.com',
          password: 'Password123!',
          phone: '+1234567891',
          role: 'ORGANISER'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('role', 'ORGANISER');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should register a new ADMIN with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'Password123!',
          phone: '+1234567892',
          role: 'ADMIN'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('role', 'ADMIN');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should reject signup with duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'First User',
          email: 'duplicate@test.com',
          password: 'Password123!',
          phone: '+1234567893',
          role: 'CUSTOMER'
        });

      // Try to create second user with same email
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Second User',
          email: 'duplicate@test.com',
          password: 'Password123!',
          phone: '+1234567894',
          role: 'CUSTOMER'
        });

      expect(res.status).toBe(409); // Conflict
      expect(res.body.success).toBe(false);
    });

    it('should reject signup with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'Password123!',
          phone: '+1234567895',
          role: 'CUSTOMER'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject signup with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@test.com',
          password: '123', // Too weak
          phone: '+1234567896',
          role: 'CUSTOMER'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject signup with missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          // Missing email, password, phone
          role: 'CUSTOMER'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject signup with invalid role', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@test.com',
          password: 'Password123!',
          phone: '+1234567897',
          role: 'INVALID_ROLE'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Login Test User',
          email: 'logintest@test.com',
          password: 'Password123!',
          phone: '+1234567898',
          role: 'CUSTOMER'
        });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('email', 'logintest@test.com');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@test.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me - Protected Route', () => {
    let token;
    let userId;

    beforeEach(async () => {
      // Create user and get token
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Protected Route Test',
          email: 'protected@test.com',
          password: 'Password123!',
          phone: '+1234567899',
          role: 'CUSTOMER'
        });

      token = res.body.data.token;
      userId = res.body.data.user._id;
    });

    it('should access protected route with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('_id', userId);
      expect(res.body.data).toHaveProperty('email', 'protected@test.com');
    });

    it('should reject access without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('token');
    });

    it('should reject access with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject access with malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject access with expired token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config/env');
      
      // Create expired token
      const expiredToken = jwt.sign(
        { _id: userId, email: 'protected@test.com', role: 'CUSTOMER' },
        config.jwtSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile - Update Profile', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Profile Test',
          email: 'profile@test.com',
          password: 'Password123!',
          phone: '+1234567800',
          role: 'CUSTOMER'
        });

      token = res.body.data.token;
      userId = res.body.data.user._id;
    });

    it('should update profile with valid data', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          phone: '+9876543210'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'Updated Name');
      expect(res.body.data).toHaveProperty('phone', '+9876543210');
    });

    it('should reject profile update without authentication', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({
          name: 'Updated Name'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject changing email to existing email', async () => {
      // Create another user
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Other User',
          email: 'other@test.com',
          password: 'Password123!',
          phone: '+1234567801',
          role: 'CUSTOMER'
        });

      // Try to change email to existing one
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'other@test.com'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Password Test',
          email: 'password@test.com',
          password: 'OldPassword123!',
          phone: '+1234567802',
          role: 'CUSTOMER'
        });

      token = res.body.data.token;
    });

    it('should change password with correct old password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          oldPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'password@test.com',
          password: 'NewPassword123!'
        });

      expect(loginRes.status).toBe(200);
    });

    it('should reject password change with incorrect old password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          oldPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject weak new password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          oldPassword: 'OldPassword123!',
          newPassword: '123' // Too weak
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
