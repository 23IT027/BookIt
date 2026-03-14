# 📅 Appointment Booking Backend

A production-ready appointment booking system built with Node.js, Express, MongoDB, Redis, Stripe, Cloudinary, and Socket.IO. Features real-time slot updates, concurrent booking prevention, role-based access control (RBAC), and Stripe payment integration.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![Redis](https://img.shields.io/badge/Redis-7+-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Setup](#-environment-setup)
- [API Documentation](#-api-documentation)
- [WebSocket Integration](#-websocket-integration)
- [Stripe Payment Integration](#-stripe-payment-integration)
- [Cloudinary Image Upload](#-cloudinary-image-upload)
- [Frontend Integration Guide](#-frontend-integration-guide)
- [Common Workflows](#-common-workflows)
- [Testing](#-testing)
- [Project Structure](#-project-structure)

---

## ✨ Features

- **🔐 Authentication & RBAC** - JWT-based auth with Customer, Organiser, and Admin roles
- **📅 Appointment Management** - Providers, appointment types, availability rules, and slot generation
- **🔒 Concurrent Booking Prevention** - Redis-based distributed locking
- **💳 Stripe Payments** - Checkout sessions, webhooks, and refunds
- **☁️ Cloudinary Integration** - Image upload and management
- **📡 Real-time Updates** - Socket.IO for live slot availability
- **📊 Admin Analytics** - Platform-wide statistics and reports
- **✅ Input Validation** - Zod-based request validation
- **🛡️ Security** - Helmet, CORS, rate limiting

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | Runtime environment |
| **Express 4.18** | Web framework |
| **MongoDB + Mongoose** | Database & ODM |
| **Redis** | Distributed locking & caching |
| **Stripe** | Payment processing |
| **Cloudinary** | Image storage & CDN |
| **Socket.IO** | Real-time WebSocket communication |
| **JWT** | Authentication tokens |
| **Zod** | Request validation |
| **Jest** | Testing framework |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Or start production server
npm start
```

The server will start at `http://localhost:3001`

---

## 🔧 Environment Setup

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/appointment-booking

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Redis (for distributed locking)
REDIS_URL=redis://localhost:6379
REDIS_LOCK_TTL=30000

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_SUCCESS_URL=http://localhost:3000/booking/success
STRIPE_CANCEL_URL=http://localhost:3000/booking/cancel

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend
FRONTEND_URL=http://localhost:3000

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/webp
```

### Required Services

1. **MongoDB Atlas** - Create a free cluster at [mongodb.com](https://www.mongodb.com/atlas)
2. **Redis** - Local installation or [Redis Cloud](https://redis.com/try-free/)
3. **Stripe** - Test keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
4. **Cloudinary** - Free account at [cloudinary.com](https://cloudinary.com/)

---

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Response Format
All responses follow this structure:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": {
    "resource": { ... }
  }
}
```

---

### 🔐 Authentication

#### POST `/api/auth/signup`
Register a new user.

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123!",
    "phone": "+1234567890",
    "role": "CUSTOMER"
  }'
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "6946487c722aeafcd62774fa",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "CUSTOMER"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST `/api/auth/login`
Login with email and password.

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123!"
  }'
```

#### GET `/api/auth/me`
Get current authenticated user.

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <token>"
```

---

### 👤 Users

#### GET `/api/users/profile`
Get user profile.

```bash
curl -X GET http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer <token>"
```

#### PATCH `/api/users/profile`
Update user profile.

```bash
curl -X PATCH http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "phone": "+9876543210"
  }'
```

---

### 🏥 Providers

#### POST `/api/providers`
Create a provider (ORGANISER/ADMIN only).

```bash
curl -X POST http://localhost:3001/api/providers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Healthcare Clinic",
    "description": "Professional healthcare services",
    "contactEmail": "contact@clinic.com",
    "contactPhone": "+1234567892",
    "address": "123 Main St, City, State 12345",
    "timezone": "America/New_York"
  }'
```

#### GET `/api/providers`
List all providers with pagination.

```bash
curl -X GET "http://localhost:3001/api/providers?page=1&limit=10"
```

#### GET `/api/providers/:id`
Get provider by ID.

```bash
curl -X GET http://localhost:3001/api/providers/6946487c722aeafcd62774fa
```

#### PATCH `/api/providers/:id`
Update provider (owner/ADMIN only).

```bash
curl -X PATCH http://localhost:3001/api/providers/6946487c722aeafcd62774fa \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Clinic Name",
    "description": "Updated description"
  }'
```

#### DELETE `/api/providers/:id`
Delete provider permanently.

```bash
curl -X DELETE http://localhost:3001/api/providers/6946487c722aeafcd62774fa \
  -H "Authorization: Bearer <token>"
```

---

### 📋 Appointment Types

#### POST `/api/appointment-types`
Create appointment type (JSON).

```bash
curl -X POST http://localhost:3001/api/appointment-types \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "6946487c722aeafcd62774fa",
    "title": "General Consultation",
    "description": "30-minute consultation",
    "durationMinutes": 30,
    "bufferMinutes": 10,
    "capacity": 1,
    "price": 100.00,
    "currency": "USD",
    "published": true,
    "category": "Healthcare",
    "tags": ["consultation", "general"]
  }'
```

#### POST `/api/appointment-types/with-images`
Create appointment type with image upload.

```bash
curl -X POST http://localhost:3001/api/appointment-types/with-images \
  -H "Authorization: Bearer <token>" \
  -F "providerId=6946487c722aeafcd62774fa" \
  -F "title=Dental Checkup" \
  -F "description=Complete dental examination" \
  -F "durationMinutes=45" \
  -F "price=150" \
  -F "currency=USD" \
  -F "published=true" \
  -F "images=@/path/to/image.jpg"
```

#### GET `/api/appointment-types`
List appointment types.

```bash
curl -X GET "http://localhost:3001/api/appointment-types?providerId=<id>&page=1&limit=10"
```

#### PATCH `/api/appointment-types/:id`
Update appointment type.

```bash
curl -X PATCH http://localhost:3001/api/appointment-types/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "price": 120.00
  }'
```

---

### 📅 Availability Rules

#### POST `/api/availability`
Create availability rule.

```bash
curl -X POST http://localhost:3001/api/availability \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "6946487c722aeafcd62774fa",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "17:00",
    "effectiveFrom": "2025-01-01",
    "effectiveTo": null,
    "exceptionDates": []
  }'
```

> **Note:** `dayOfWeek` uses 0=Sunday, 1=Monday, ..., 6=Saturday

#### GET `/api/availability/provider/:providerId`
Get all availability rules for a provider.

```bash
curl -X GET http://localhost:3001/api/availability/provider/6946487c722aeafcd62774fa
```

#### PATCH `/api/availability/:id`
Update availability rule.

```bash
curl -X PATCH http://localhost:3001/api/availability/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "08:00",
    "endTime": "18:00"
  }'
```

---

### ⏰ Slots

#### GET `/api/slots/:providerId`
Generate available slots for a specific date.

```bash
curl -X GET "http://localhost:3001/api/slots/6946487c722aeafcd62774fa?date=2025-12-23"
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Available slots retrieved",
  "data": {
    "date": "2025-12-23",
    "providerId": "6946487c722aeafcd62774fa",
    "totalSlots": 16,
    "slots": [
      {
        "startTime": "09:00",
        "endTime": "09:30",
        "available": true
      },
      {
        "startTime": "09:30",
        "endTime": "10:00",
        "available": true
      }
    ]
  }
}
```

#### GET `/api/slots/:providerId/check`
Check if a specific slot is available.

```bash
curl -X GET "http://localhost:3001/api/slots/<providerId>/check?date=2025-12-23&startTime=10:00&endTime=10:30"
```

#### GET `/api/slots/:providerId/schedule`
Get provider schedule for a date range.

```bash
curl -X GET "http://localhost:3001/api/slots/<providerId>/schedule?startDate=2025-12-20&endDate=2025-12-27"
```

---

### 📖 Bookings

#### POST `/api/bookings`
Create a new booking (with Redis locking).

```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "6946487c722aeafcd62774fa",
    "appointmentTypeId": "6946487c722aeafcd62774fb",
    "startTime": "2025-12-23T10:00:00.000Z",
    "customerNotes": "First consultation"
  }'
```

#### GET `/api/bookings/customer`
Get customer's bookings.

```bash
curl -X GET "http://localhost:3001/api/bookings/customer?status=PENDING" \
  -H "Authorization: Bearer <token>"
```

#### GET `/api/bookings/provider/:providerId`
Get provider's bookings (ORGANISER/ADMIN).

```bash
curl -X GET "http://localhost:3001/api/bookings/provider/<providerId>?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

#### PATCH `/api/bookings/:id/status`
Update booking status.

```bash
curl -X PATCH http://localhost:3001/api/bookings/<id>/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED"
  }'
```

#### PATCH `/api/bookings/:id/cancel`
Cancel a booking.

```bash
curl -X PATCH http://localhost:3001/api/bookings/<id>/cancel \
  -H "Authorization: Bearer <token>"
```

---

### 💳 Payments

#### POST `/api/payment/create-checkout`
Create Stripe checkout session.

```bash
curl -X POST http://localhost:3001/api/payment/create-checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "6946487c722aeafcd62774fc"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
}
```

#### GET `/api/payment/booking/:bookingId`
Get payment status for a booking.

```bash
curl -X GET http://localhost:3001/api/payment/booking/<bookingId> \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/payment/:paymentId/refund`
Request a refund.

```bash
curl -X POST http://localhost:3001/api/payment/<paymentId>/refund \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested cancellation"
  }'
```

---

### 👑 Admin

All admin routes require `ADMIN` role.

#### GET `/api/admin/analytics`
Get platform analytics.

```bash
curl -X GET "http://localhost:3001/api/admin/analytics?startDate=2025-12-01&endDate=2025-12-31" \
  -H "Authorization: Bearer <admin-token>"
```

#### GET `/api/admin/users`
List all users.

```bash
curl -X GET "http://localhost:3001/api/admin/users?role=CUSTOMER&page=1&limit=20" \
  -H "Authorization: Bearer <admin-token>"
```

#### PATCH `/api/admin/users/:userId/role`
Update user role.

```bash
curl -X PATCH http://localhost:3001/api/admin/users/<userId>/role \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "ORGANISER"
  }'
```

#### GET `/api/admin/reports`
Generate system reports.

```bash
curl -X GET "http://localhost:3001/api/admin/reports?type=bookings&startDate=2025-12-01&endDate=2025-12-31" \
  -H "Authorization: Bearer <admin-token>"
```

---

## 📡 WebSocket Integration

The server uses Socket.IO for real-time slot availability updates.

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinProvider` | Client → Server | Subscribe to provider updates |
| `leaveProvider` | Client → Server | Unsubscribe from provider |
| `joined` | Server → Client | Confirmation of room join |
| `slotTaken` | Server → Client | Slot was booked |
| `bookingCancelled` | Server → Client | Booking was cancelled |
| `availabilityUpdated` | Server → Client | Availability rule changed |
| `ping/pong` | Bidirectional | Connection health check |

### Client Example (JavaScript)

```javascript
import { io } from 'socket.io-client';

// Connect to WebSocket server
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  withCredentials: true
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
  
  // Join a provider's room to receive updates
  socket.emit('joinProvider', 'providerId123');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

// Room confirmation
socket.on('joined', (data) => {
  console.log('Joined room:', data.room);
});

// Real-time slot updates
socket.on('slotTaken', (data) => {
  console.log('Slot taken:', data);
  // Update UI - remove this slot from available slots
  const { date, startTime, endTime, bookingId } = data;
  updateSlotUI(date, startTime, false);
});

socket.on('bookingCancelled', (data) => {
  console.log('Booking cancelled:', data);
  // Update UI - slot is now available again
  const { date, startTime, endTime } = data;
  updateSlotUI(date, startTime, true);
});

socket.on('availabilityUpdated', (data) => {
  console.log('Availability updated:', data);
  // Refresh slots for the affected dates
  refreshSlots();
});

// Connection health check
setInterval(() => {
  socket.emit('ping');
}, 30000);

socket.on('pong', (data) => {
  console.log('Server responded at:', data.timestamp);
});

// Cleanup on unmount
function cleanup() {
  socket.emit('leaveProvider', 'providerId123');
  socket.disconnect();
}
```

### React Hook Example

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSlotUpdates(providerId) {
  const [socket, setSocket] = useState(null);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('joinProvider', providerId);
    });

    newSocket.on('slotTaken', (data) => {
      setSlots(prev => prev.map(slot => 
        slot.startTime === data.startTime && slot.date === data.date
          ? { ...slot, available: false }
          : slot
      ));
    });

    newSocket.on('bookingCancelled', (data) => {
      setSlots(prev => prev.map(slot => 
        slot.startTime === data.startTime && slot.date === data.date
          ? { ...slot, available: true }
          : slot
      ));
    });

    return () => {
      newSocket.emit('leaveProvider', providerId);
      newSocket.disconnect();
    };
  }, [providerId]);

  return { slots, setSlots };
}
```

---

## 💳 Stripe Payment Integration

### Setup

1. Get test API keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Payment Flow

```
Customer → Create Booking → Create Checkout Session → Stripe Checkout Page
                                       ↓
                              Payment Complete
                                       ↓
                              Webhook Triggered → Update Booking Status
```

### Testing with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/payment/webhook

# The CLI will output a webhook secret (whsec_...)
# Add this to your .env file
```

### Test Card Numbers

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 3220` | 3D Secure authentication |
| `4000 0000 0000 9995` | Insufficient funds |

### Frontend Checkout Example

```javascript
async function handleCheckout(bookingId) {
  try {
    const response = await fetch('http://localhost:3001/api/payment/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ bookingId })
    });
    
    const data = await response.json();
    
    // Redirect to Stripe Checkout
    window.location.href = data.data.checkoutUrl;
  } catch (error) {
    console.error('Checkout failed:', error);
  }
}
```

---

## ☁️ Cloudinary Image Upload

### Setup

1. Create account at [cloudinary.com](https://cloudinary.com/)
2. Add credentials to `.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

### Upload Endpoint

Use the `/api/appointment-types/with-images` endpoint:

```javascript
const formData = new FormData();
formData.append('providerId', providerId);
formData.append('title', 'Dental Checkup');
formData.append('description', 'Complete examination');
formData.append('durationMinutes', '45');
formData.append('price', '150');
formData.append('currency', 'USD');
formData.append('published', 'true');
formData.append('images', fileInput.files[0]);

const response = await fetch('http://localhost:3001/api/appointment-types/with-images', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData // Don't set Content-Type, browser will set it automatically
});
```

### Supported File Types
- JPEG
- PNG
- WebP
- Max size: 5MB

---

## 🔗 Frontend Integration Guide

### Axios Setup

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Fetch Setup

```javascript
const BASE_URL = 'http://localhost:3001/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
  };
  
  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  
  return response.json();
}

// Usage examples
const login = (email, password) => 
  apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

const getSlots = (providerId, date) =>
  apiRequest(`/slots/${providerId}?date=${date}`);

const createBooking = (bookingData) =>
  apiRequest('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData)
  });
```

### JWT Token Handling

```javascript
// After login/signup
const { data } = await api.post('/auth/login', { email, password });
localStorage.setItem('authToken', data.data.token);

// Get current user
const { data } = await api.get('/auth/me');
const user = data.data.user;

// Logout
localStorage.removeItem('authToken');
```

---

## 📋 Common Workflows

### Customer Booking Flow

```mermaid
graph LR
    A[Signup/Login] --> B[Browse Providers]
    B --> C[Select Appointment Type]
    C --> D[View Available Slots]
    D --> E[Create Booking]
    E --> F[Stripe Checkout]
    F --> G[Booking Confirmed]
```

**Code Example:**

```javascript
// 1. Login
const { data: authData } = await api.post('/auth/login', {
  email: 'customer@test.com',
  password: 'Password123!'
});
localStorage.setItem('authToken', authData.data.token);

// 2. Browse providers
const { data: providers } = await api.get('/providers?page=1&limit=10');

// 3. Get appointment types for a provider
const { data: types } = await api.get(`/appointment-types?providerId=${providerId}`);

// 4. Get available slots
const { data: slots } = await api.get(`/slots/${providerId}?date=2025-12-23`);

// 5. Create booking
const { data: booking } = await api.post('/bookings', {
  providerId,
  appointmentTypeId,
  startTime: '2025-12-23T10:00:00.000Z',
  customerNotes: 'First visit'
});

// 6. Create checkout session
const { data: checkout } = await api.post('/payment/create-checkout', {
  bookingId: booking.data.booking._id
});

// 7. Redirect to Stripe
window.location.href = checkout.data.checkoutUrl;
```

### Organiser Setup Flow

```javascript
// 1. Signup as Organiser
const { data: authData } = await api.post('/auth/signup', {
  name: 'Jane Organiser',
  email: 'organiser@test.com',
  password: 'Password123!',
  phone: '+1234567891',
  role: 'ORGANISER'
});

// 2. Create Provider
const { data: provider } = await api.post('/providers', {
  name: 'Healthcare Clinic',
  description: 'Professional healthcare services',
  contactEmail: 'contact@clinic.com',
  contactPhone: '+1234567892',
  address: '123 Main St',
  timezone: 'America/New_York'
});

// 3. Create Appointment Types
const { data: appointmentType } = await api.post('/appointment-types', {
  providerId: provider.data.provider._id,
  title: 'General Consultation',
  durationMinutes: 30,
  price: 100,
  currency: 'USD',
  published: true
});

// 4. Set Availability Rules (Mon-Fri, 9am-5pm)
for (let day = 1; day <= 5; day++) {
  await api.post('/availability', {
    providerId: provider.data.provider._id,
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '17:00',
    effectiveFrom: new Date().toISOString().split('T')[0]
  });
}

// 5. View Bookings
const { data: bookings } = await api.get(`/bookings/provider/${providerId}`);
```

### Admin Analytics Flow

```javascript
// Get platform analytics
const { data: analytics } = await api.get('/admin/analytics', {
  params: {
    startDate: '2025-12-01',
    endDate: '2025-12-31'
  }
});

// Get all users
const { data: users } = await api.get('/admin/users?role=CUSTOMER');

// Generate reports
const { data: reports } = await api.get('/admin/reports', {
  params: {
    type: 'bookings',
    startDate: '2025-12-01',
    endDate: '2025-12-31'
  }
});
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Authentication tests
npm run test:auth

# RBAC tests
npm run test:rbac

# Provider tests
npm run test:provider

# Appointment type tests
npm run test:appointment

# Availability and slots tests
npm run test:availability

# Booking and payment tests
npm run test:booking

# Concurrency tests (Redis locking)
npm run test:concurrency

# WebSocket and admin tests
npm run test:websocket
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Quick Tests (excluding slow concurrency tests)

```bash
npm run test:quick
```

### Test with Postman

Import the `Postman_Collection.json` file into Postman. The collection includes:
- 43 requests across all endpoints
- Auto-extraction of IDs and tokens
- Pre-request validation scripts
- Test scripts for response validation

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Server initialization
│   ├── config/
│   │   ├── db.js           # MongoDB connection
│   │   ├── redis.js        # Redis connection
│   │   ├── stripe.js       # Stripe initialization
│   │   ├── cloudinary.js   # Cloudinary setup
│   │   ├── websocket.js    # Socket.IO setup
│   │   └── env.js          # Environment variables
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── provider.controller.js
│   │   ├── appointmentType.controller.js
│   │   ├── availability.controller.js
│   │   ├── slot.controller.js
│   │   ├── booking.controller.js
│   │   ├── payment.controller.js
│   │   └── admin.controller.js
│   ├── models/
│   │   ├── user.model.js
│   │   ├── provider.model.js
│   │   ├── appointmentType.model.js
│   │   ├── availabilityRule.model.js
│   │   ├── booking.model.js
│   │   └── payment.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── provider.routes.js
│   │   ├── appointmentType.routes.js
│   │   ├── availability.routes.js
│   │   ├── slot.routes.js
│   │   ├── booking.routes.js
│   │   ├── payment.routes.js
│   │   └── admin.routes.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── validation.middleware.js
│   │   └── error.middleware.js
│   ├── services/
│   │   ├── slot.service.js
│   │   ├── booking.service.js
│   │   └── payment.service.js
│   └── helpers/
│       └── response.helper.js
├── tests/
│   ├── auth.test.js
│   ├── provider.test.js
│   ├── booking-payment.test.js
│   └── ...
├── uploads/                # Temporary file uploads
├── .env.example
├── package.json
├── jest.config.js
└── README.md
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For support, email support@example.com or open an issue in the repository.
