# Backend .env Configuration Guide

Use this guide to fill in your `backend/.env` file.

---

## Required (must set for app to run)

| Variable | Description | Example / Where to get it |
|----------|-------------|---------------------------|
| **PORT** | Server port (frontend expects 3001) | `3001` |
| **MONGO_URI** | MongoDB connection string | Local: `mongodb://localhost:27017/appointment-booking` <br> Atlas: `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/appointment-booking` |
| **JWT_SECRET** | Secret for signing JWTs (min 32 characters) | Any long random string, e.g. generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| **REDIS_URL** | Redis connection (for slot locking) | Local: `redis://localhost:6379` <br> Redis Cloud: `redis://default:PASSWORD@host:port` |
| **FRONTEND_URL** | Frontend origin (for CORS) | `http://localhost:3000` |

---

## Optional but recommended

### Stripe (payments)

| Variable | Where to get it |
|----------|-----------------|
| **STRIPE_SECRET_KEY** | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → Secret key (starts with `sk_test_`) |
| **STRIPE_WEBHOOK_SECRET** | After running `stripe listen --forward-to localhost:3001/api/payment/webhook` (starts with `whsec_`) |
| **STRIPE_SUCCESS_URL** | `http://localhost:3000/booking/success` |
| **STRIPE_CANCEL_URL** | `http://localhost:3000/booking/cancel` |

Without Stripe keys, payment/checkout features will not work.

### Email (OTP & notifications)

| Variable | Description |
|----------|-------------|
| **EMAIL_HOST** | `smtp.gmail.com` for Gmail |
| **EMAIL_PORT** | `587` |
| **EMAIL_USER** | Your Gmail address |
| **EMAIL_PASSWORD** | [App Password](https://myaccount.google.com/apppasswords) (not your normal Gmail password) |
| **EMAIL_FROM** | Sender name, e.g. `BookEase <noreply@yourapp.com>` |

Without email config, OTP verification and booking emails may fail.

### Cloudinary (provider/appointment images)

| Variable | Where to get it |
|----------|-----------------|
| **CLOUDINARY_CLOUD_NAME** | [Cloudinary Console](https://cloudinary.com/console) → Dashboard |
| **CLOUDINARY_API_KEY** | Same dashboard |
| **CLOUDINARY_API_SECRET** | Same dashboard |

Without Cloudinary, image upload for appointment types may not work.

---

## Optional (usually fine as-is)

| Variable | Default | Purpose |
|----------|---------|---------|
| **NODE_ENV** | `development` | Use `production` when deploying |
| **JWT_EXPIRES_IN** | `7d` | Token expiry |
| **REDIS_LOCK_TTL** | `30000` | Slot lock TTL (ms) |
| **OTP_EXPIRES_IN** | `10` | OTP validity (minutes) |
| **OTP_LENGTH** | `6` | OTP digit count |
| **MAX_FILE_SIZE** | `5242880` | Max upload size (5MB) |
| **ALLOWED_FILE_TYPES** | `image/jpeg,...` | Allowed image types |

---

## Quick start (minimal .env)

To run the app with basic auth and booking (no payments/email/images), set at least:

```env
PORT=3001
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/appointment-booking
JWT_SECRET=replace-with-a-long-random-string-at-least-32-chars
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
```

Ensure MongoDB and Redis are running locally (or use Atlas + Redis Cloud and update the URLs).

---

## Generate a secure JWT_SECRET

In terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `JWT_SECRET` in your `.env`.
