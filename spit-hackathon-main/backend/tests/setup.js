/**
 * Test Setup and Teardown
 * Sets up test database, Redis, and mocks external services
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const redis = require('redis');

let mongoServer;
let redisClient;

// Mock Cloudinary
jest.mock('../src/services/cloudinary.service', () => ({
  uploadImage: jest.fn().mockResolvedValue({
    url: 'https://res.cloudinary.com/test/image/upload/test-image.jpg',
    publicId: 'test-image-id'
  }),
  uploadMultipleImages: jest.fn().mockResolvedValue([
    {
      url: 'https://res.cloudinary.com/test/image/upload/test-image-1.jpg',
      publicId: 'test-image-1'
    },
    {
      url: 'https://res.cloudinary.com/test/image/upload/test-image-2.jpg',
      publicId: 'test-image-2'
    }
  ]),
  deleteImage: jest.fn().mockResolvedValue(true),
  deleteMultipleImages: jest.fn().mockResolvedValue(true)
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123'
        })
      }
    },
    webhooks: {
      constructEvent: jest.fn((payload, signature, secret) => {
        if (signature === 'invalid') {
          throw new Error('Invalid signature');
        }
        return {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              payment_status: 'paid',
              metadata: {
                bookingId: 'test-booking-id'
              }
            }
          }
        };
      })
    },
    refunds: {
      create: jest.fn().mockResolvedValue({
        id: 'ref_test_123',
        status: 'succeeded'
      })
    }
  }));
});

// Setup before all tests
beforeAll(async () => {
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  console.log('📁 Test MongoDB connected');

  // Setup test Redis client (use test Redis or mock)
  // For integration tests, use real Redis
  // For unit tests, mock Redis
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    await redisClient.flushDb(); // Clear test data
    console.log('🔄 Test Redis connected');
  } catch (error) {
    console.warn('⚠️  Redis not available, using mock');
    // Mock Redis for tests
    global.mockRedis = true;
  }
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  console.log('✅ Test cleanup complete');
});

// Clear database between tests
beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  }
  
  // Clear Redis between tests
  if (redisClient && redisClient.isOpen) {
    await redisClient.flushDb();
  }
});

// Global test utilities
global.testUtils = {
  createTestUser: async (role = 'CUSTOMER') => {
    const User = require('../src/models/user.model');
    const user = await User.create({
      name: `Test ${role}`,
      email: `${role.toLowerCase()}-${Date.now()}@test.com`,
      passwordHash: 'password123',
      role,
      phone: '+1234567890'
    });
    return user;
  },

  generateToken: (user) => {
    const jwt = require('jsonwebtoken');
    const config = require('../src/config/env');
    return jwt.sign(
      { _id: user._id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
  },

  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

module.exports = {
  mongoServer,
  redisClient
};
