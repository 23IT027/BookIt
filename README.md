# 📅 BookIt - Appointment Booking System



![BookEase](https://img.shields.io/badge/BookEase-Appointment%20Booking-00CED1?style=for-the-badge&logo=calendar&logoColor=white)

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Stripe](https://img.shields.io/badge/Stripe-008CDD?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io/)

**A modern, real-time appointment booking system with integrated payments, OTP verification, and multi-role support.**

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Usage](#-usage) • [API Docs](#-api-documentation)

</div>

---

## 🎯 Overview

BookEase is a comprehensive appointment booking platform that connects service providers with customers. It features real-time slot management, secure Stripe payments (INR), OTP email verification, and a beautiful modern UI built with React and Tailwind CSS.

### 👥 User Roles

| Role | Description |
|------|-------------|
| **Customer** | Browse providers, book appointments, manage bookings, request refunds |
| **Organiser/Provider** | Create appointment types, manage availability, handle bookings |
| **Admin** | Platform oversight, user management, analytics dashboard |

---

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication with secure token management
- OTP email verification for signup
- Role-based access control (RBAC)
- Password encryption with bcrypt
- Rate limiting & security headers (Helmet)

### 📅 Booking System
- **Real-time slot availability** with Redis locking
- **Interactive calendar** with month navigation
- **Time slot grouping** (Morning, Afternoon, Evening)
- **Booking management** - Cancel, Reschedule, View details
- **Booking status tracking** - Pending, Confirmed, Cancelled, Completed
- **Shareable booking links** for providers

### 💳 Payments (Stripe)
- Secure checkout with Stripe (INR currency)
- Payment status tracking (Pending, Paid, Refunded)
- Automatic refund processing for cancellations
- Webhook integration for payment events

### 📧 Notifications
- Email notifications via Nodemailer
- OTP verification emails
- Booking confirmation emails
- Calendar invite (.ics) generation

### 🎨 Modern UI/UX
- Responsive design with Tailwind CSS
- Smooth animations with Framer Motion
- Dark theme with glassmorphism effects
- Real-time updates via WebSocket

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **MongoDB** | Database |
| **Mongoose** | ODM for MongoDB |
| **Redis** | Caching & slot locking |
| **Socket.io** | Real-time communication |
| **Stripe** | Payment processing |
| **Nodemailer** | Email service |
| **Cloudinary** | Image storage |
| **JWT** | Authentication |
| **Jest** | Testing |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI library |
| **Vite** | Build tool |
| **Tailwind CSS** | Styling |
| **Framer Motion** | Animations |
| **Zustand** | State management |
| **React Router** | Routing |
| **Axios** | HTTP client |
| **Socket.io Client** | WebSocket client |
| **Recharts** | Analytics charts |
| **Lucide React** | Icons |

---

## 📁 Project Structure

```
📦 appointment-booking-system
├── 📂 backend/
│   ├── 📂 src/
│   │   ├── 📂 config/          # Database, Redis, Stripe config
│   │   ├── 📂 controllers/     # Route handlers
│   │   ├── 📂 middlewares/     # Auth, validation, error handling
│   │   ├── 📂 models/          # Mongoose schemas
│   │   ├── 📂 routes/          # API routes
│   │   ├── 📂 services/        # Business logic
│   │   ├── 📂 helpers/         # Utility functions
│   │   ├── 📄 app.js           # Express app setup
│   │   └── 📄 server.js        # Server entry point
│   ├── 📂 tests/               # Jest test suites
│   └── 📄 package.json
│
├── 📂 frontend/
│   ├── 📂 src/
│   │   ├── 📂 api/             # API service layer
│   │   ├── 📂 auth/            # Auth store (Zustand)
│   │   ├── 📂 components/      # Reusable UI components
│   │   │   ├── 📂 booking/     # Booking components
│   │   │   ├── 📂 layout/      # Navbar, Sidebar, Footer
│   │   │   └── 📂 ui/          # Cards, Buttons, Modals
│   │   ├── 📂 pages/           # Route pages
│   │   │   ├── 📂 admin/       # Admin dashboard
│   │   │   ├── 📂 auth/        # Login, Signup
│   │   │   ├── 📂 booking/     # Public booking flow
│   │   │   ├── 📂 customer/    # Customer dashboard
│   │   │   └── 📂 organiser/   # Provider dashboard
│   │   ├── 📂 socket/          # WebSocket setup
│   │   └── 📂 utils/           # Helper functions
│   └── 📄 package.json
│
└── 📄 README.md
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** v18+ 
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud)
- **Stripe Account** (for payments)
- **Cloudinary Account** (for images)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Aryanpatel8799/spit-hackathon.git
cd spit-hackathon
```

### 2️⃣ Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Configure `.env` file:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/appointment-booking

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

### 3️⃣ Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Configure `.env` file:

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_STRIPE_PUBLIC_KEY=pk_test_your_public_key
```

Start the frontend:

```bash
npm run dev
```

### 4️⃣ Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api

---

## 📖 Usage

### For Customers

1. **Sign Up** with email (OTP verification required)
2. **Browse Providers** in the provider directory
3. **Select Service** and choose available date/time
4. **Complete Payment** via Stripe checkout
5. **Manage Bookings** - View, Cancel, or Reschedule

### For Providers/Organisers

1. **Sign Up** as an Organiser
2. **Set Availability** - Define working hours and days
3. **Create Appointment Types** - Services with pricing
4. **Share Booking Link** - Unique URL for customers
5. **Manage Bookings** - Confirm, Reschedule, or Cancel

### For Admins

1. **Dashboard** - View platform analytics
2. **User Management** - Monitor users and providers
3. **Booking Oversight** - Track all platform bookings
