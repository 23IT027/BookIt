const { Server } = require('socket.io');
const config = require('./env');

/**
 * Initialize WebSocket server for real-time slot updates
 */

let io = null;

const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join provider room to receive updates for specific provider
    socket.on('joinProvider', (providerId) => {
      const room = `provider:${providerId}`;
      socket.join(room);
      console.log(`📍 Client ${socket.id} joined room: ${room}`);
      
      socket.emit('joined', {
        providerId,
        room,
        message: 'Successfully joined provider room'
      });
    });

    // Leave provider room
    socket.on('leaveProvider', (providerId) => {
      const room = `provider:${providerId}`;
      socket.leave(room);
      console.log(`📍 Client ${socket.id} left room: ${room}`);
    });

    // Handle ping for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Make io globally accessible
  global.io = io;

  console.log('✅ WebSocket server initialized');

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
};

// Emit slot taken event
const emitSlotTaken = (providerId, slotData) => {
  if (io) {
    io.to(`provider:${providerId}`).emit('slotTaken', {
      providerId,
      ...slotData,
      timestamp: Date.now()
    });
    console.log(`📡 Emitted slotTaken event for provider: ${providerId}`);
  }
};

// Emit booking cancelled event
const emitBookingCancelled = (providerId, bookingData) => {
  if (io) {
    io.to(`provider:${providerId}`).emit('bookingCancelled', {
      providerId,
      ...bookingData,
      timestamp: Date.now()
    });
    console.log(`📡 Emitted bookingCancelled event for provider: ${providerId}`);
  }
};

// Emit availability updated event
const emitAvailabilityUpdated = (providerId, availabilityData) => {
  if (io) {
    io.to(`provider:${providerId}`).emit('availabilityUpdated', {
      providerId,
      ...availabilityData,
      timestamp: Date.now()
    });
    console.log(`📡 Emitted availabilityUpdated event for provider: ${providerId}`);
  }
};

module.exports = {
  initializeWebSocket,
  getIO,
  emitSlotTaken,
  emitBookingCancelled,
  emitAvailabilityUpdated
};
