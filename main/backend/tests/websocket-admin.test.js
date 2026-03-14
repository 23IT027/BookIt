/**
 * WebSocket Real-time Tests & Admin Analytics Tests
 * Tests: Socket.IO connections, real-time slot updates, admin analytics endpoints
 */

const request = require('supertest');
const app = require('../src/app');
const io = require('socket.io-client');

describe('WebSocket Real-time Updates', () => {
  let customerToken;
  let organiserToken;
  let providerId, appointmentTypeId;
  let socketUrl;
  let clientSocket;

  beforeAll(() => {
    socketUrl = `http://localhost:${process.env.PORT || 3001}`;
  });

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

    // Setup provider and appointment type
    const providerRes = await request(app)
      .post('/api/providers')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        title: 'WebSocket Test Provider',
        description: 'Test',
        contactEmail: 'provider@test.com',
        contactPhone: '+3333333333'
      });
    providerId = providerRes.body.data._id;

    const typeRes = await request(app)
      .post('/api/appointment-types')
      .set('Authorization', `Bearer ${organiserToken}`)
      .send({
        providerId,
        title: 'Test Type',
        description: 'Test',
        durationMinutes: 30,
        price: 100,
        currency: 'USD',
        published: true
      });
    appointmentTypeId = typeRes.body.data._id;

    // Create availability
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
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Socket.IO Connection', () => {
    it('should connect to WebSocket server with valid token', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: customerToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    }, 10000);

    it('should reject connection with invalid token', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Timeout if no error received
      setTimeout(() => {
        if (clientSocket.connected) {
          done(new Error('Should not connect with invalid token'));
        }
      }, 2000);
    }, 10000);

    it('should reject connection without token', (done) => {
      clientSocket = io(socketUrl, {
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      setTimeout(() => {
        if (clientSocket.connected) {
          done(new Error('Should not connect without token'));
        }
      }, 2000);
    }, 10000);
  });

  describe('Room Subscription', () => {
    it('should join provider room', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: customerToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Join provider room
        clientSocket.emit('joinProvider', { providerId });

        clientSocket.on('joinedProvider', (data) => {
          expect(data).toHaveProperty('providerId', providerId);
          done();
        });
      });
    }, 10000);

    it('should leave provider room', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: customerToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        // Join then leave
        clientSocket.emit('joinProvider', { providerId });

        clientSocket.on('joinedProvider', () => {
          clientSocket.emit('leaveProvider', { providerId });

          clientSocket.on('leftProvider', (data) => {
            expect(data).toHaveProperty('providerId', providerId);
            done();
          });
        });
      });
    }, 10000);

    it('should handle joining multiple provider rooms', (done) => {
      // Create second provider
      request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          title: 'Second Provider',
          description: 'Test',
          contactEmail: 'provider2@test.com',
          contactPhone: '+4444444444'
        })
        .then((providerRes2) => {
          const providerId2 = providerRes2.body.data._id;

          clientSocket = io(socketUrl, {
            auth: { token: customerToken },
            transports: ['websocket']
          });

          let joinCount = 0;

          clientSocket.on('connect', () => {
            clientSocket.emit('joinProvider', { providerId });
            clientSocket.emit('joinProvider', { providerId: providerId2 });
          });

          clientSocket.on('joinedProvider', () => {
            joinCount++;
            if (joinCount === 2) {
              done();
            }
          });
        });
    }, 10000);
  });

  describe('Real-time Slot Updates', () => {
    it('should receive slotTaken event when booking is made', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: customerToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinProvider', { providerId });

        clientSocket.on('joinedProvider', async () => {
          // Get available slot
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const date = tomorrow.toISOString().split('T')[0];

          const slotsRes = await request(app)
            .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
            .set('Authorization', `Bearer ${customerToken}`);

          if (slotsRes.body.data.length > 0) {
            const slotTime = slotsRes.body.data[0].startTime;

            // Listen for slotTaken event
            clientSocket.on('slotTaken', (data) => {
              expect(data).toHaveProperty('providerId', providerId);
              expect(data).toHaveProperty('startTime', slotTime);
              done();
            });

            // Create booking (should trigger event)
            await request(app)
              .post('/api/bookings')
              .set('Authorization', `Bearer ${customerToken}`)
              .send({
                appointmentTypeId,
                startTime: slotTime
              });
          } else {
            done(new Error('No available slots'));
          }
        });
      });
    }, 15000);

    it('should receive slotFreed event when booking is cancelled', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: customerToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('joinProvider', { providerId });

        clientSocket.on('joinedProvider', async () => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const date = tomorrow.toISOString().split('T')[0];

          const slotsRes = await request(app)
            .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
            .set('Authorization', `Bearer ${customerToken}`);

          if (slotsRes.body.data.length > 0) {
            const slotTime = slotsRes.body.data[0].startTime;

            // Create booking first
            const bookingRes = await request(app)
              .post('/api/bookings')
              .set('Authorization', `Bearer ${customerToken}`)
              .send({
                appointmentTypeId,
                startTime: slotTime
              });

            const bookingId = bookingRes.body.data._id;

            // Listen for slotFreed event
            clientSocket.on('slotFreed', (data) => {
              expect(data).toHaveProperty('providerId', providerId);
              expect(data).toHaveProperty('startTime', slotTime);
              done();
            });

            // Cancel booking (should trigger event)
            setTimeout(async () => {
              await request(app)
                .patch(`/api/bookings/${bookingId}/cancel`)
                .set('Authorization', `Bearer ${customerToken}`);
            }, 500);
          } else {
            done(new Error('No available slots'));
          }
        });
      });
    }, 15000);

    it('should not receive events when not subscribed to provider', (done) => {
      // Create second provider
      request(app)
        .post('/api/providers')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          title: 'Unsubscribed Provider',
          description: 'Test',
          contactEmail: 'unsubscribed@test.com',
          contactPhone: '+5555555555'
        })
        .then((providerRes2) => {
          const providerId2 = providerRes2.body.data._id;

          clientSocket = io(socketUrl, {
            auth: { token: customerToken },
            transports: ['websocket']
          });

          let eventReceived = false;

          clientSocket.on('connect', () => {
            // Subscribe to providerId2 only
            clientSocket.emit('joinProvider', { providerId: providerId2 });

            clientSocket.on('slotTaken', (data) => {
              if (data.providerId === providerId) {
                eventReceived = true;
              }
            });

            // Wait a bit then create booking on providerId (not subscribed)
            setTimeout(async () => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const date = tomorrow.toISOString().split('T')[0];

              const slotsRes = await request(app)
                .get(`/api/slots/generate?providerId=${providerId}&appointmentTypeId=${appointmentTypeId}&date=${date}`)
                .set('Authorization', `Bearer ${customerToken}`);

              if (slotsRes.body.data.length > 0) {
                await request(app)
                  .post('/api/bookings')
                  .set('Authorization', `Bearer ${customerToken}`)
                  .send({
                    appointmentTypeId,
                    startTime: slotsRes.body.data[0].startTime
                  });

                // Wait to see if event is received
                setTimeout(() => {
                  expect(eventReceived).toBe(false);
                  done();
                }, 2000);
              } else {
                done();
              }
            }, 1000);
          });
        });
    }, 20000);
  });

  describe('Reconnection Handling', () => {
    it('should reconnect after disconnect', (done) => {
      clientSocket = io(socketUrl, {
        auth: { token: customerToken },
        transports: ['websocket'],
        reconnectionDelay: 100
      });

      let connectCount = 0;

      clientSocket.on('connect', () => {
        connectCount++;

        if (connectCount === 1) {
          // First connection, disconnect
          clientSocket.disconnect();
        } else if (connectCount === 2) {
          // Reconnected successfully
          expect(clientSocket.connected).toBe(true);
          done();
        }
      });

      // Trigger reconnection
      setTimeout(() => {
        if (connectCount === 1 && !clientSocket.connected) {
          clientSocket.connect();
        }
      }, 500);
    }, 10000);
  });
});

describe('Admin Analytics & Management', () => {
  let adminToken, adminUser;
  let organiserToken;
  let customerToken;

  beforeEach(async () => {
    // Create admin directly (bypassing validation since ADMIN role not allowed in signup)
    adminUser = await global.testUtils.createTestUser('ADMIN');
    adminToken = global.testUtils.generateToken(adminUser);

    // Create organiser
    const organiserRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Organiser',
        email: `organiser-${Date.now()}@test.com`,
        password: 'Password123!',
        phone: '+2222222222',
        role: 'ORGANISER'
      });
    organiserToken = organiserRes.body.data.token;

    // Create customer
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
  });

  describe('GET /api/admin/analytics - System Analytics', () => {
    it('should get analytics as ADMIN', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalUsers');
      expect(res.body.data).toHaveProperty('totalBookings');
      expect(res.body.data).toHaveProperty('totalRevenue');
      expect(res.body.data).toHaveProperty('usersByRole');
      expect(typeof res.body.data.totalUsers).toBe('number');
    });

    it('should forbid ORGANISER from viewing analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(403);
    });

    it('should forbid CUSTOMER from viewing analytics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return correct user counts by role', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.usersByRole).toHaveProperty('CUSTOMER');
      expect(res.body.data.usersByRole).toHaveProperty('ORGANISER');
      expect(res.body.data.usersByRole).toHaveProperty('ADMIN');
    });

    it('should support date range filtering', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const res = await request(app)
        .get(`/api/admin/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('dateRange');
    });
  });

  describe('GET /api/admin/users - User Management', () => {
    it('should list all users as ADMIN', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3); // Admin, organiser, customer
    });

    it('should forbid non-ADMIN from listing users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${organiserToken}`);

      expect(res.status).toBe(403);
    });

    it('should filter users by role', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=CUSTOMER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(u => u.role === 'CUSTOMER')).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body).toHaveProperty('pagination');
    });
  });

  describe('PATCH /api/admin/users/:id/role - Update User Role', () => {
    it('should allow ADMIN to change user role', async () => {
      // Create a test user
      const userRes = await request(app)
        .post('/api/auth/signup')
        .send({
          title: 'Role Change Test',
          email: `roletest-${Date.now()}@test.com`,
          password: 'Password123!',
          phone: '+4444444444',
          role: 'CUSTOMER'
        });

      const userId = userRes.body.data.user._id;

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'ORGANISER'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('ORGANISER');
    });

    it('should forbid non-ADMIN from changing roles', async () => {
      const res = await request(app)
        .patch('/api/admin/users/fake-id/role')
        .set('Authorization', `Bearer ${organiserToken}`)
        .send({
          role: 'ADMIN'
        });

      expect(res.status).toBe(403);
    });

    it('should reject invalid role values', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/fake-id/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'INVALID_ROLE'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/reports - System Reports', () => {
    it('should generate booking report', async () => {
      const res = await request(app)
        .get('/api/admin/reports?type=bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
    });

    it('should generate revenue report', async () => {
      const res = await request(app)
        .get('/api/admin/reports?type=revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
    });

    it('should forbid non-ADMIN from generating reports', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
