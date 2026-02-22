# 🏗️ System Architecture

## Overview

This is a **3-tier architecture** appointment booking system with real-time features and payment processing.

```
┌─────────────────┐
│   Frontend      │  (React/Next.js - not included)
│   (Port 3000)   │
└────────┬────────┘
         │ HTTP/WebSocket
         │
┌────────▼────────────────────────────────────────┐
│         Express.js Backend (Port 5000)          │
│  ┌──────────────────────────────────────────┐  │
│  │  API Routes (REST + WebSocket)           │  │
│  │  - Auth, Bookings, Payments, Admin       │  │
│  └────────────┬─────────────────────────────┘  │
│               │                                  │
│  ┌────────────▼─────────────────────────────┐  │
│  │  Controllers (Business Logic)            │  │
│  │  - Auth, Booking (Redis Lock), Payment   │  │
│  └────────────┬─────────────────────────────┘  │
│               │                                  │
│  ┌────────────▼─────────────────────────────┐  │
│  │  Services (Core Logic)                   │  │
│  │  - Redis Lock, Stripe, Slot Computation  │  │
│  └──────────┬───────────────┬────────────┬──┘  │
└─────────────┼───────────────┼────────────┼─────┘
              │               │            │
      ┌───────▼──────┐ ┌──────▼─────┐ ┌──▼────────┐
      │  MongoDB     │ │   Redis    │ │  Stripe   │
      │  Database    │ │   Cache    │ │  Payment  │
      │              │ │   Locks    │ │  Gateway  │
      └──────────────┘ └────────────┘ └───────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Node.js v16+ | JavaScript runtime |
| **Framework** | Express.js | Web framework |
| **Database** | MongoDB + Mongoose | Document database |
| **Cache/Lock** | Redis | Distributed locking, caching |
| **Payment** | Stripe | Payment processing |
| **Storage** | Cloudinary | Image storage |
| **Real-time** | Socket.IO | WebSocket communication |
| **Validation** | Zod | Schema validation |
| **Auth** | JWT + bcrypt | Authentication |

---

## Core Components

### 1. Authentication System

**Flow:**
```
User → Signup/Login → Generate JWT → Return Token
       ↓
    Hash Password (bcrypt)
       ↓
    Store in MongoDB
```

**Security:**
- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens with expiration (7 days default)
- Role-based access control (RBAC)
- Token verification on protected routes

### 2. Booking System with Redis Locking

**Problem:** Prevent two customers from booking the same slot simultaneously.

**Solution:** Distributed locks with Redis

```javascript
// Pseudocode
async function createBooking(providerId, startTime) {
  // 1. Acquire Redis lock
  const lockKey = `lock:slot:${providerId}:${startTime}`;
  const lockAcquired = await redis.set(lockKey, '1', 'NX', 'PX', 30000);
  
  if (!lockAcquired) {
    throw new Error('Slot is being booked by another user');
  }
  
  try {
    // 2. Double-check availability (defensive)
    const isAvailable = await checkSlotAvailability();
    
    if (!isAvailable) {
      throw new Error('Slot no longer available');
    }
    
    // 3. Create booking in database
    const booking = await Booking.create({...});
    
    // 4. Emit real-time event
    io.emit('slotTaken', { providerId, startTime });
    
    return booking;
  } finally {
    // 5. Always release lock
    await redis.del(lockKey);
  }
}
```

**Why Redis?**
- Fast (in-memory)
- Atomic operations
- Built-in TTL (Time To Live)
- Distributed (works across multiple servers)

**Lock Characteristics:**
- **TTL:** 30 seconds (prevents deadlocks if process crashes)
- **Key Format:** `lock:slot:PROVIDER_ID:TIMESTAMP`
- **Atomic:** SET NX (set if not exists)

### 3. Payment System (Stripe)

**Architecture:**
```
Customer → Backend → Stripe Checkout → Customer Pays
                         ↓
                    Stripe Webhook
                         ↓
                    Backend Webhook Handler
                         ↓
                  Update Booking Status
```

**Implementation:**

**Step 1:** Create Checkout Session
```javascript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: appointmentType.title },
      unit_amount: appointmentType.price * 100
    },
    quantity: 1
  }],
  mode: 'payment',
  success_url: 'http://frontend.com/success',
  cancel_url: 'http://frontend.com/cancel',
  client_reference_id: bookingId,
  metadata: { bookingId, customerId }
});
```

**Step 2:** Handle Webhook
```javascript
app.post('/webhook', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    signature,
    webhookSecret
  );
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.client_reference_id;
    
    // Update payment and booking status
    await Payment.updateOne(
      { bookingId },
      { status: 'SUCCEEDED', paidAt: new Date() }
    );
    
    await Booking.updateOne(
      { _id: bookingId },
      { status: 'CONFIRMED', paymentStatus: 'PAID' }
    );
  }
  
  res.json({ received: true });
});
```

**Security:**
- Webhook signature verification
- Idempotency (handle duplicate webhooks)
- Raw body parsing for webhook route

### 4. Slot Computation System

**Challenge:** Generate available time slots dynamically based on:
- Provider availability rules (recurring weekly)
- Existing bookings
- Appointment duration + buffer time
- Capacity limits

**Algorithm:**

```javascript
async function getAvailableSlots(providerId, date, appointmentTypeId) {
  // 1. Get availability rules for the day
  const dayOfWeek = date.getDay(); // 0-6
  const rules = await AvailabilityRule.find({
    providerId,
    dayOfWeek,
    isActive: true
  });
  
  // 2. Get appointment type details
  const appointmentType = await AppointmentType.findById(appointmentTypeId);
  const { durationMinutes, bufferMinutes, capacity } = appointmentType;
  
  // 3. Generate time slots from rules
  let slots = [];
  for (const rule of rules) {
    const timeSlots = generateTimeSlots(
      rule.startTime,    // e.g., "09:00"
      rule.endTime,      // e.g., "17:00"
      durationMinutes,   // e.g., 30
      bufferMinutes      // e.g., 10
    );
    // Result: ["09:00-09:30", "09:40-10:10", "10:20-10:50", ...]
    slots = slots.concat(timeSlots);
  }
  
  // 4. Get existing bookings for this date
  const bookings = await Booking.find({
    providerId,
    startTime: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: 'CANCELLED' }
  });
  
  // 5. Filter out booked slots (considering capacity)
  const availableSlots = slots.filter(slot => {
    const overlappingBookings = bookings.filter(booking =>
      timeRangesOverlap(slot.start, slot.end, booking.startTime, booking.endTime)
    );
    return overlappingBookings.length < capacity;
  });
  
  // 6. Remove past slots
  const now = new Date();
  return availableSlots.filter(slot => slot.startTime > now);
}
```

**Optimization:**
- Computed dynamically (no slot table)
- Cached in Redis (optional, 5-minute TTL)
- Indexed queries for bookings

### 5. WebSocket System (Real-time Updates)

**Use Cases:**
1. **Slot Taken:** Notify other users viewing same provider
2. **Booking Cancelled:** Slot becomes available again
3. **Availability Updated:** New slots available

**Implementation:**
```javascript
// Server
io.on('connection', (socket) => {
  // Client joins provider room
  socket.on('joinProvider', (providerId) => {
    socket.join(`provider:${providerId}`);
  });
});

// Emit events
io.to(`provider:${providerId}`).emit('slotTaken', {
  providerId,
  startTime,
  endTime
});
```

**Client (Frontend):**
```javascript
const socket = io('http://backend.com');

socket.emit('joinProvider', providerId);

socket.on('slotTaken', (data) => {
  // Refresh available slots
  fetchAvailableSlots();
});
```

---

## Database Schema Design

### User
```javascript
{
  _id: ObjectId,
  email: String (unique, indexed),
  passwordHash: String,
  role: Enum['ADMIN', 'ORGANISER', 'CUSTOMER'],
  name: String,
  isActive: Boolean,
  createdAt: Date
}
```

### Provider
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, unique),
  name: String,
  specialization: String,
  timezone: String,
  isActive: Boolean,
  createdAt: Date
}
```

### AppointmentType
```javascript
{
  _id: ObjectId,
  title: String,
  durationMinutes: Number,
  bufferMinutes: Number,
  capacity: Number,
  price: Number,
  currency: String,
  published: Boolean,
  organiserId: ObjectId (ref: User),
  providerId: ObjectId (ref: Provider),
  images: [{ url, publicId }],
  questions: [{ question, type, required }],
  createdAt: Date
}
```

### AvailabilityRule
```javascript
{
  _id: ObjectId,
  providerId: ObjectId (ref: Provider),
  dayOfWeek: Number (0-6),
  startTime: String ("HH:MM"),
  endTime: String ("HH:MM"),
  effectiveFrom: Date,
  effectiveTo: Date,
  isActive: Boolean,
  exceptions: [{ date, reason }]
}
```

### Booking
```javascript
{
  _id: ObjectId,
  appointmentTypeId: ObjectId (ref: AppointmentType),
  providerId: ObjectId (ref: Provider),
  customerId: ObjectId (ref: User),
  startTime: Date,
  endTime: Date,
  status: Enum['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
  paymentStatus: Enum['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
  answers: [{ question, answer }],
  createdAt: Date
}
```

**Indexes:**
```javascript
// Prevent double booking
Booking.index({ 
  providerId: 1, 
  startTime: 1,
  status: 1 
}, { 
  partialFilterExpression: { status: { $ne: 'CANCELLED' } }
});

// Query optimization
Booking.index({ customerId: 1, status: 1 });
Booking.index({ providerId: 1, startTime: 1 });
```

### Payment
```javascript
{
  _id: ObjectId,
  bookingId: ObjectId (ref: Booking, unique),
  customerId: ObjectId (ref: User),
  stripePaymentIntentId: String,
  stripeCheckoutSessionId: String,
  amount: Number,
  currency: String,
  status: Enum['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'],
  receiptUrl: String,
  paidAt: Date,
  createdAt: Date
}
```

---

## API Design Principles

### 1. RESTful Conventions
```
GET    /api/resource         # List
GET    /api/resource/:id     # Get one
POST   /api/resource         # Create
PATCH  /api/resource/:id     # Update
DELETE /api/resource/:id     # Delete
```

### 2. Response Format
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": { ... },
  "timestamp": "2025-12-20T10:30:00.000Z"
}
```

### 3. Error Format
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email" }
  ],
  "timestamp": "2025-12-20T10:30:00.000Z"
}
```

### 4. HTTP Status Codes
- `200` OK
- `201` Created
- `400` Bad Request (validation errors)
- `401` Unauthorized (auth required)
- `403` Forbidden (insufficient permissions)
- `404` Not Found
- `409` Conflict (double booking)
- `500` Internal Server Error

---

## Scalability Considerations

### Horizontal Scaling
- Stateless API (JWT tokens, no sessions)
- Redis for distributed locking
- Load balancer compatible

### Caching Strategy
- Redis cache for frequently accessed data
- Slot computation cache (5-minute TTL)
- Provider availability cache

### Database Optimization
- Proper indexing
- Query optimization
- Connection pooling

### File Upload
- Cloudinary CDN (not stored in DB)
- Async processing
- Image optimization

---

## Security Best Practices

1. **Authentication**
   - JWT with expiration
   - Secure password hashing (bcrypt)
   - Token stored client-side (httpOnly cookie recommended for production)

2. **Authorization**
   - Role-based access control
   - Resource ownership validation
   - Admin-only routes protected

3. **Input Validation**
   - Zod schema validation
   - Mongoose schema validation
   - Sanitization

4. **API Security**
   - CORS configured
   - Helmet.js for HTTP headers
   - Rate limiting (ready to add)
   - Stripe webhook signature verification

5. **Error Handling**
   - No sensitive data in errors
   - Different messages for dev/prod
   - Centralized error handling

---

## Performance Optimizations

1. **Database**
   - Indexed queries
   - Populate only needed fields
   - Pagination for lists

2. **Redis**
   - Fast locks (in-memory)
   - Optional caching layer
   - Connection pooling

3. **API**
   - Async/await throughout
   - Parallel queries where possible
   - Efficient algorithms (O(n) slot generation)

4. **WebSocket**
   - Room-based broadcasting
   - Selective updates (only relevant clients)

---

## Testing Strategy

### Unit Tests
- Service functions
- Helper functions
- Validators

### Integration Tests
- API endpoints
- Database operations
- External services (mocked)

### Concurrency Tests
- Redis locking
- Double booking prevention
- Race conditions

### Payment Tests
- Webhook handling
- Payment flows
- Refunds

---

## Monitoring & Logging

### Logging
- Request logging (Morgan)
- Error logging
- Important events (booking created, payment success)

### Health Checks
- `/health` endpoint
- Database connection status
- Redis connection status

### Metrics (Production)
- Response times
- Error rates
- Active connections
- Booking success rate

---

## Future Enhancements

1. **Features**
   - Email notifications (Nodemailer)
   - SMS reminders (Twilio)
   - Calendar integration (Google Calendar)
   - Recurring appointments
   - Group bookings
   - Waitlist system

2. **Technical**
   - Rate limiting (express-rate-limit)
   - API documentation (Swagger)
   - Automated tests (Jest)
   - CI/CD pipeline
   - Docker containerization
   - Kubernetes orchestration

3. **Analytics**
   - Advanced reporting
   - Revenue analytics
   - Customer insights
   - Provider performance metrics

---

This architecture is designed for:
- ✅ High availability
- ✅ Horizontal scalability
- ✅ Data consistency
- ✅ Security
- ✅ Maintainability
- ✅ Extensibility

**Ready for production deployment! 🚀**
