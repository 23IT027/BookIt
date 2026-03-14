const { createClient } = require('redis');
const config = require('./env');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis reconnection limit reached');
            return new Error('Redis reconnection limit exceeded');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis connected and ready');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    await redisClient.connect();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await redisClient.quit();
      console.log('Redis connection closed through app termination');
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.warn('⚠️  Continuing without Redis - locking features will be disabled');
    return null;
  }
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    console.warn('⚠️  Redis client not available');
    return null;
  }
  return redisClient;
};

module.exports = {
  connectRedis,
  getRedisClient
};
