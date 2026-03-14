# 📚 API Documentation Summary

Base URL: `http://localhost:5000/api`

---

## 🔐 Authentication

All protected routes require JWT token in header:
```
Authorization: Bearer <your_jwt_token>
```

### Signup
```http
POST /auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "CUSTOMER", // or "ORGANISER"
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

---

## 👥 Users

### Get Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PATCH /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Updated",
  "phone": "+1234567899"
}
```

---

## 🏥 Providers

### Create Provider (Organiser only)
```http
POST /providers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Medical Clinic",
  "description": "Professional medical services",
  "specialization": "General Medicine",
  "timezone": "America/New_York",
  "contactEmail": "clinic@example.com",
  "contactPhone": "+1234567890"
}
```

### List Providers
```http
GET /providers?page=1&limit=10&search=medical&specialization=medicine

Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 10)
- search: Search term
- specialization: Filter by specialization
- isActive: true/false
```

### Get Provider by ID
```http
GET /providers/:id
```

---

## 📅 Appointment Types

### Create Appointment Type (Organiser only)
```http
POST /appointment-types
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "General Consultation",
  "description": "30-minute consultation",
  "durationMinutes": 30,
  "bufferMinutes": 10,
  "capacity": 1,
  "price": 50.00,
  "currency": "USD",
  "published": true,
  "providerId": "provider_id_here",
  "category": "Medical",
  "tags": ["consultation", "general"],
  "location": {
    "type": "IN_PERSON",
    "address": "123 Main St"
  },
  "questions": [
    {
      "question": "Reason for visit?",
      "type": "TEXTAREA",
      "required": true
    }
  ],
  "cancellationPolicy": {
    "allowed": true,
    "hoursBeforeStart": 24,
    "refundPercentage": 100
  }
}
```

### Upload Images
```http
POST /appointment-types/:id/images
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- images: File[] (max 5 images, 5MB each)
```

### List Appointment Types
```http
GET /appointment-types?providerId=xxx&published=true&category=Medical

Query Parameters:
- page, limit: Pagination
- search: Search term
- category: Filter by category
- providerId: Filter by provider
- published: true/false
- minPrice, maxPrice: Price range
```

---

## ⏰ Availability

### Create Availability Rule (Organiser only)
```http
POST /availability
Authorization: Bearer <token>
Content-Type: application/json

{
  "providerId": "provider_id",
  "dayOfWeek": 1, // 0=Sunday, 1=Monday, ..., 6=Saturday
  "startTime": "09:00",
  "endTime": "17:00",
  "effectiveFrom": "2025-01-01",
  "effectiveTo": null // null = no end date
}
```

### Get Provider Availability
```http
GET /availability/provider/:providerId?includeInactive=false
```

### Add Exception (holiday, day off)
```http
POST /availability/:id/exceptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2025-12-25",
  "reason": "Christmas holiday"
}
```

---

## 🎯 Slots (Availability Computation)

### Get Available Slots
```http
GET /slots/:providerId?date=2025-12-21&appointmentTypeId=xxx

Query Parameters:
- date: YYYY-MM-DD format (REQUIRED)
- appointmentTypeId: Filter for specific appointment type
```

**Response:**
```json
{
  "success": true,
  "data": {
    "providerId": "...",
    "date": "2025-12-21",
    "totalSlots": 15,
    "slots": [
      {
        "startTime": "2025-12-21T09:00:00.000Z",
        "endTime": "2025-12-21T09:30:00.000Z",
        "appointmentTypeId": "...",
        "providerId": "..."
      },
      // ... more slots
    ]
  }
}
```

### Check Specific Slot Availability
```http
GET /slots/:providerId/check?startTime=2025-12-21T10:00:00.000Z
```

---

## 📆 Bookings (with Redis Locking!)

### Create Booking 🔒
```http
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "appointmentTypeId": "appointment_type_id",
  "providerId": "provider_id",
  "startTime": "2025-12-21T10:00:00.000Z",
  "answers": [
    {
      "question": "Reason for visit?",
      "answer": "Regular checkup"
    }
  ],
  "customerNotes": "Looking forward to it"
}
```

**Success Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Booking created successfully",
  "data": {
    "booking": { ... },
    "requiresPayment": true
  }
}
```

**Conflict Response (slot already booked):**
```json
{
  "success": false,
  "statusCode": 409,
  "message": "This slot is currently being booked by another user"
}
```

### Get Customer Bookings
```http
GET /bookings/customer?status=CONFIRMED&page=1&limit=10
Authorization: Bearer <token>

Query Parameters:
- status: PENDING, CONFIRMED, CANCELLED, COMPLETED
- page, limit: Pagination
```

### Get Provider Bookings
```http
GET /bookings/provider/:providerId?startDate=2025-12-01&endDate=2025-12-31
Authorization: Bearer <token>
```

### Cancel Booking
```http
PATCH /bookings/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Schedule conflict"
}
```

**Note:** Cancellation policy is checked automatically.

### Update Booking Status (Provider/Admin only)
```http
PATCH /bookings/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "COMPLETED",
  "providerNotes": "Patient showed up on time"
}
```

---

## 💳 Payments (Stripe Integration)

### Create Checkout Session
```http
POST /payment/create-checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": "booking_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_xxx",
    "sessionUrl": "https://checkout.stripe.com/pay/cs_test_xxx",
    "bookingId": "..."
  }
}
```

**Next Step:** Redirect customer to `sessionUrl` to complete payment.

### Webhook Endpoint (Stripe calls this)
```http
POST /payment/webhook
Content-Type: application/json
Stripe-Signature: xxx

// Stripe sends checkout.session.completed event
// Backend automatically updates booking status
```

**This is called automatically by Stripe - no manual testing needed in production.**

### Get Payment by Booking
```http
GET /payment/booking/:bookingId
Authorization: Bearer <token>
```

### Get Customer Payments
```http
GET /payment/customer?status=SUCCEEDED&page=1
Authorization: Bearer <token>
```

### Request Refund
```http
POST /payment/:paymentId/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}
```

---

## 👑 Admin Routes

All admin routes require `ADMIN` role.

### Get Platform Analytics
```http
GET /admin/analytics?startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "bookings": {
        "total": 1250,
        "confirmed": 1100,
        "cancelled": 150,
        "cancellationRate": 12.0
      },
      "revenue": 50000.00,
      "users": {
        "total": 500,
        "providers": 25
      },
      "appointmentTypes": 75
    }
  }
}
```

### Get Provider Analytics
```http
GET /admin/analytics/provider/:providerId?startDate=2025-01-01
Authorization: Bearer <admin_token>
```

### Get Booking Trends
```http
GET /admin/analytics/trends?days=30&providerId=xxx
Authorization: Bearer <admin_token>
```

### Get All Users
```http
GET /admin/users?role=CUSTOMER&isActive=true&search=john&page=1
Authorization: Bearer <admin_token>
```

### Update User Status
```http
PATCH /admin/users/:userId/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

### Update User Role
```http
PATCH /admin/users/:userId/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "ORGANISER"
}
```

### Get System Reports
```http
GET /admin/reports
Authorization: Bearer <admin_token>
```

---

## 📡 WebSocket Events

### Connect to WebSocket
```javascript
const socket = io('http://localhost:5000');
```

### Join Provider Room
```javascript
socket.emit('joinProvider', providerId);

socket.on('joined', (data) => {
  console.log('Joined room:', data);
});
```

### Listen for Events

**Slot Taken:**
```javascript
socket.on('slotTaken', (data) => {
  // data: { providerId, startTime, endTime, bookingId, timestamp }
  console.log('Slot booked:', data);
  // Refresh available slots UI
});
```

**Booking Cancelled:**
```javascript
socket.on('bookingCancelled', (data) => {
  // data: { providerId, bookingId, startTime, timestamp }
  console.log('Booking cancelled:', data);
  // Refresh available slots UI
});
```

**Availability Updated:**
```javascript
socket.on('availabilityUpdated', (data) => {
  // data: { providerId, timestamp }
  console.log('Availability changed:', data);
  // Refresh provider schedule
});
```

---

## 🧪 Testing Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-20T10:30:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

---

## 🔄 Common Workflows

### Complete Booking Flow

1. **Customer browses providers**
   ```
   GET /providers
   ```

2. **Customer views appointment types**
   ```
   GET /appointment-types?providerId=xxx
   ```

3. **Customer checks available slots**
   ```
   GET /slots/:providerId?date=2025-12-21&appointmentTypeId=xxx
   ```

4. **Customer creates booking**
   ```
   POST /bookings
   ```

5. **Customer initiates payment**
   ```
   POST /payment/create-checkout
   ```

6. **Customer pays on Stripe (external)**

7. **Stripe webhook updates booking (automatic)**
   ```
   POST /payment/webhook
   ```

8. **Customer views confirmed booking**
   ```
   GET /bookings/customer
   ```

### Organiser Setup Flow

1. **Organiser registers**
   ```
   POST /auth/signup (role: ORGANISER)
   ```

2. **Create provider profile**
   ```
   POST /providers
   ```

3. **Create appointment types**
   ```
   POST /appointment-types
   ```

4. **Set availability rules**
   ```
   POST /availability (for each day of week)
   ```

5. **Monitor bookings**
   ```
   GET /bookings/provider/:providerId
   ```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "statusCode": 401,
  "message": "No token provided"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Access denied. Required role: ORGANISER"
}
```

### 404 Not Found
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Provider not found"
}
```

### 409 Conflict (Double Booking)
```json
{
  "success": false,
  "statusCode": 409,
  "message": "This slot is currently being booked by another user"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## 📋 Test Cards (Stripe)

| Card Number         | Result  |
|---------------------|---------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 9995 | Declined |
| 4000 0000 0000 0002 | Card declined |
| 4000 0025 0000 3155 | Requires authentication |

Expiry: Any future date  
CVC: Any 3 digits  
ZIP: Any 5 digits

---

## 🎯 Rate Limits

Currently not implemented, but recommended for production:
- Authentication: 5 requests/minute
- General API: 100 requests/minute
- Admin routes: 50 requests/minute

---

**For complete examples, import the Postman collection!** 🚀
