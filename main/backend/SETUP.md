# 🚀 Quick Start Guide

## Prerequisites Installation

### 1. Install Node.js
```bash
# macOS (using Homebrew)
brew install node

# Verify installation
node --version
npm --version
```

### 2. Install MongoDB
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Verify
mongosh
```

**Alternative:** Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier)

### 3. Install Redis
```bash
# macOS
brew install redis
brew services start redis

# Verify
redis-cli ping
# Should return: PONG
```

**Alternative:** Use [Redis Cloud](https://redis.com/try-free/) (free tier)

---

## Project Setup

### 1. Clone or Extract Project
```bash
cd backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit with your credentials
nano .env
```

**Minimum Required Configuration:**
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/appointment-booking
JWT_SECRET=your-super-secret-jwt-key-change-this
REDIS_URL=redis://localhost:6379
```

**For Full Features (Stripe + Cloudinary):**
```env
# Get from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Get from https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Seed Database with Test Data
```bash
npm run seed
```

**Test Accounts Created:**
- Admin: `admin@example.com` / `admin123`
- Organiser: `organiser@example.com` / `organiser123`
- Customer 1: `customer1@example.com` / `customer123`
- Customer 2: `customer2@example.com` / `customer123`

### 5. Start Server
```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server runs at: `http://localhost:5000`

---

## Testing the API

### Option 1: Import Postman Collection
1. Open Postman
2. Import `postman_collection.json`
3. Set collection variables:
   - `base_url`: `http://localhost:5000/api`
4. Start with **Auth → Login**
5. Token auto-saves to collection variables

### Option 2: Using cURL

**1. Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organiser@example.com",
    "password": "organiser123"
  }'
```

Save the token from response.

**2. Create Provider:**
```bash
curl -X POST http://localhost:5000/api/providers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Medical Clinic",
    "description": "Professional services",
    "specialization": "General Medicine",
    "timezone": "America/New_York"
  }'
```

**3. Get Available Slots:**
```bash
curl http://localhost:5000/api/slots/PROVIDER_ID?date=2025-12-21
```

---

## Testing Concurrency (Redis Locking)

### Setup
1. Login as two different customers
2. Get their JWT tokens
3. Edit `src/tests/concurrency.test.js`:
   ```javascript
   const testConfig = {
     providerId: 'ACTUAL_PROVIDER_ID',
     appointmentTypeId: 'ACTUAL_APPOINTMENT_TYPE_ID',
     startTime: '2025-12-21T10:00:00.000Z',
     customerTokens: [
       'CUSTOMER_1_TOKEN',
       'CUSTOMER_2_TOKEN'
     ]
   };
   ```

### Run Test
```bash
node src/tests/concurrency.test.js
```

**Expected Result:**
- ✅ Only ONE booking succeeds
- ❌ Second booking gets 409 Conflict error
- Proves Redis locking works!

---

## Testing Stripe Payments

### Setup Stripe CLI (for webhook testing)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/api/payment/webhook
```

Copy the webhook secret and add to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Test Flow
1. Login as customer
2. Create a booking
3. Create checkout session:
   ```bash
   curl -X POST http://localhost:5000/api/payment/create-checkout \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"bookingId": "BOOKING_ID"}'
   ```
4. Open `sessionUrl` in browser
5. Use test card: `4242 4242 4242 4242`
6. Webhook automatically updates booking status

---

## WebSocket Testing

### Using Socket.IO Client
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected');
  
  // Join provider room
  socket.emit('joinProvider', 'PROVIDER_ID');
});

socket.on('slotTaken', (data) => {
  console.log('Slot booked:', data);
});

socket.on('bookingCancelled', (data) => {
  console.log('Booking cancelled:', data);
});
```

### Testing Real-time Updates
1. Open two browser tabs/terminals
2. Both join same provider room
3. Create booking in one
4. See real-time update in other

---

## Common Issues & Solutions

### MongoDB Connection Failed
```bash
# Check if MongoDB is running
brew services list

# Start MongoDB
brew services start mongodb-community

# Or use MongoDB Atlas connection string
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### Redis Connection Failed
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
brew services start redis

# Or use Redis Cloud connection string
REDIS_URL=redis://username:password@host:port
```

### Port Already in Use
```bash
# Find process using port 5000
lsof -ti:5000

# Kill the process
kill -9 $(lsof -ti:5000)

# Or change port in .env
PORT=3001
```

### Stripe Webhook Not Working
```bash
# Make sure Stripe CLI is running
stripe listen --forward-to localhost:5000/api/payment/webhook

# Check webhook secret matches .env
stripe listen --print-secret
```

---

## API Flow Examples

### Complete Booking Flow

**1. Register Customer**
```
POST /api/auth/signup
```

**2. Login**
```
POST /api/auth/login
```

**3. Browse Providers**
```
GET /api/providers
```

**4. View Appointment Types**
```
GET /api/appointment-types?providerId=XXX
```

**5. Check Available Slots**
```
GET /api/slots/PROVIDER_ID?date=2025-12-21&appointmentTypeId=XXX
```

**6. Create Booking** (Redis lock acquired here!)
```
POST /api/bookings
```

**7. Create Payment**
```
POST /api/payment/create-checkout
```

**8. Customer pays on Stripe**

**9. Webhook updates status** (automatic)

**10. View Booking**
```
GET /api/bookings/customer
```

---

## Architecture Highlights

### Redis Locking Flow
```
Customer 1: Book 10:00 AM slot
  ↓
Acquire Redis lock: lock:slot:PROVIDER_ID:TIMESTAMP
  ↓
Check availability (double-check)
  ↓
Create booking in MongoDB
  ↓
Release lock
  ↓
Emit WebSocket event

Customer 2: Book SAME slot (simultaneous)
  ↓
Try to acquire SAME lock → FAILS (already locked)
  ↓
Return 409 Conflict
  ↓
Customer 2 must choose different slot
```

### Payment Webhook Flow
```
Customer clicks "Pay" → Redirect to Stripe
  ↓
Stripe processes payment
  ↓
Stripe sends webhook to /api/payment/webhook
  ↓
Verify webhook signature
  ↓
Update Payment status: SUCCEEDED
  ↓
Update Booking status: CONFIRMED
  ↓
Update Booking paymentStatus: PAID
```

---

## Production Deployment

### Environment Variables Checklist
- [ ] Strong `JWT_SECRET` (min 32 chars)
- [ ] Production MongoDB URI
- [ ] Production Redis URL
- [ ] Production Stripe keys
- [ ] Production Cloudinary credentials
- [ ] Set `NODE_ENV=production`
- [ ] Set production `FRONTEND_URL`

### Recommended Hosting
- **Backend:** Heroku, Railway, Render, AWS
- **MongoDB:** MongoDB Atlas
- **Redis:** Redis Cloud, Upstash
- **Frontend:** Vercel, Netlify

### Health Check
```bash
curl http://your-domain.com/health
```

---

## Need Help?

1. Check server logs for errors
2. Review API response error messages
3. Test with Postman collection
4. Verify all services (MongoDB, Redis) are running
5. Check environment variables are set correctly

---

## 🎉 You're Ready!

The backend is fully functional with:
- ✅ Authentication & Authorization
- ✅ Real-time booking with Redis locking
- ✅ Stripe payment integration
- ✅ WebSocket real-time updates
- ✅ Image uploads (Cloudinary)
- ✅ Analytics & reporting
- ✅ Comprehensive testing

**Start building your frontend and happy hacking! 🚀**
