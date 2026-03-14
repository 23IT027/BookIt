require('dotenv').config();
const http = require('http');
const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initializeStripe } = require('./config/stripe');
const { initializeCloudinary } = require('./config/cloudinary');
const { initializeWebSocket } = require('./config/websocket');
const fs = require('fs');
const path = require('path');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Create HTTP server
const server = http.createServer(app);

// Initialize services
const initializeServices = async () => {
  try {
    console.log('🚀 Initializing services...\n');

    // Connect to MongoDB
    await connectDB();

    // Connect to Redis (optional, but recommended)
    await connectRedis();

    // Initialize Stripe
    initializeStripe();

    // Initialize Cloudinary
    initializeCloudinary();

    // Initialize WebSocket
    initializeWebSocket(server);

    console.log('\n✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await initializeServices();

  server.listen(config.port, () => {
    console.log('\n' + '='.repeat(50));
    console.log(`🎉 Server running on port ${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`📍 API URL: http://localhost:${config.port}`);
    console.log(`🏥 Health Check: http://localhost:${config.port}/health`);
    console.log('='.repeat(50) + '\n');
  });
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('✅ HTTP server closed');

    // Close database connections
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');

    // Close Redis connection
    const { getRedisClient } = require('./config/redis');
    const redis = getRedisClient();
    if (redis) {
      await redis.quit();
      console.log('✅ Redis connection closed');
    }

    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

module.exports = server;
