import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.currentProvider = null;
  }

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected:', this.socket.id);
      
      // Rejoin provider room if we had one
      if (this.currentProvider) {
        this.joinProvider(this.currentProvider);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error.message);
    });

    // Server events
    this.socket.on('joined', (data) => {
      console.log('📍 Joined room:', data.room);
    });

    this.socket.on('pong', (data) => {
      console.log('🏓 Pong received:', data.timestamp);
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  disconnect() {
    if (this.socket) {
      if (this.currentProvider) {
        this.leaveProvider(this.currentProvider);
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.stopHeartbeat();
  }

  joinProvider(providerId) {
    if (!this.socket?.connected) {
      this.currentProvider = providerId;
      return;
    }
    
    this.currentProvider = providerId;
    this.socket.emit('joinProvider', providerId);
    console.log('📍 Joining provider room:', providerId);
  }

  leaveProvider(providerId) {
    if (!this.socket?.connected) return;
    
    this.socket.emit('leaveProvider', providerId);
    if (this.currentProvider === providerId) {
      this.currentProvider = null;
    }
    console.log('📍 Left provider room:', providerId);
  }

  // Subscribe to slot taken events
  onSlotTaken(callback) {
    if (!this.socket) return;
    
    const handler = (data) => {
      console.log('🎫 Slot taken:', data);
      callback(data);
    };
    
    this.socket.on('slotTaken', handler);
    this.listeners.set('slotTaken', handler);
  }

  // Subscribe to booking cancelled events
  onBookingCancelled(callback) {
    if (!this.socket) return;
    
    const handler = (data) => {
      console.log('❌ Booking cancelled:', data);
      callback(data);
    };
    
    this.socket.on('bookingCancelled', handler);
    this.listeners.set('bookingCancelled', handler);
  }

  // Subscribe to availability updated events
  onAvailabilityUpdated(callback) {
    if (!this.socket) return;
    
    const handler = (data) => {
      console.log('📅 Availability updated:', data);
      callback(data);
    };
    
    this.socket.on('availabilityUpdated', handler);
    this.listeners.set('availabilityUpdated', handler);
  }

  // Remove all listeners
  removeAllListeners() {
    this.listeners.forEach((handler, event) => {
      this.socket?.off(event, handler);
    });
    this.listeners.clear();
  }

  // Heartbeat
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
