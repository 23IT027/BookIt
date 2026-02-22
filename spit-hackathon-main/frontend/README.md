# 🎯 BookIt Frontend

A premium, hackathon-winning appointment booking frontend built with React.js and Tailwind CSS.

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.0-38B2AC?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-5.0.0-646CFF?logo=vite)
![TypeScript Ready](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript)

## ✨ Features

### 🎨 Design
- **Dark Premium Theme** - Deep blacks with cyan/blue accents
- **Glass Morphism UI** - Modern card designs with backdrop blur
- **Smooth Animations** - Framer Motion powered transitions
- **Responsive Design** - Mobile-first, works on all devices

### 👤 Customer Experience
- Browse and search providers
- Real-time slot availability
- **Live slot updates via WebSocket** (slots disappear when booked!)
- Secure Stripe payment integration
- Booking history with status tracking

### 🏢 Organiser Dashboard
- Provider management (CRUD)
- Appointment type management with image upload
- Visual availability editor
- Booking management with status controls
- Analytics charts (Recharts)

### 🔐 Admin Panel
- System-wide dashboard
- User management
- Analytics and reporting
- System health monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend running on port 3001

### Installation

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key_here
```

## 📁 Project Structure

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/                    # API layer (Axios)
│   │   └── index.js
│   ├── auth/                   # Authentication (Zustand)
│   │   └── authStore.js
│   ├── socket/                 # WebSocket service
│   │   ├── socketService.js
│   │   └── useSocket.js
│   ├── utils/                  # Helpers
│   │   └── helpers.js
│   ├── components/
│   │   ├── ui/                 # Base UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── layout/             # Layout components
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Layout.jsx
│   │   ├── calendar/           # Calendar components
│   │   │   └── DatePicker.jsx
│   │   └── booking/            # Booking components
│   │       ├── SlotGrid.jsx
│   │       ├── BookingCard.jsx
│   │       └── BookingFlow.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Signup.jsx
│   │   ├── customer/
│   │   │   ├── ProviderList.jsx
│   │   │   ├── ProviderDetail.jsx
│   │   │   └── MyBookings.jsx
│   │   ├── organiser/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProviderManagement.jsx
│   │   │   ├── AppointmentTypes.jsx
│   │   │   ├── Availability.jsx
│   │   │   └── BookingManagement.jsx
│   │   ├── admin/
│   │   │   ├── Dashboard.jsx
│   │   │   └── UserManagement.jsx
│   │   └── payment/
│   │       ├── Success.jsx
│   │       └── Cancel.jsx
│   ├── App.jsx                 # Main app with routing
│   ├── main.jsx                # Entry point
│   └── index.css               # Tailwind + custom styles
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.example
```

## 🎮 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@test.com | test123 |
| Organiser | organiser@test.com | test123 |
| Admin | admin@test.com | test123 |

## 🔌 Real-time Features

### WebSocket Events

The app connects to Socket.IO for real-time updates:

```javascript
// Slot becomes unavailable instantly when someone books
socket.on('slotTaken', (data) => {
  // Slot visually disappears with animation
});

// Slot reappears if booking is cancelled
socket.on('bookingCancelled', (data) => {
  // Slot reappears with animation
});
```

## 💳 Stripe Integration

Payment flow:
1. User selects date and slot
2. Clicks "Pay" button
3. Backend creates Stripe Checkout Session
4. User is redirected to Stripe hosted page
5. On success, redirected to `/payment/success`
6. WebSocket notifies other users the slot is taken

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18.2 |
| Build Tool | Vite 5.0 |
| Styling | Tailwind CSS 3.4 |
| State Management | Zustand 4.4 |
| Routing | React Router 6.21 |
| HTTP Client | Axios 1.6 |
| WebSocket | Socket.IO Client 4.6 |
| Animations | Framer Motion 10.17 |
| Charts | Recharts 2.10 |
| Icons | Lucide React |
| Payments | Stripe.js 2.4 |
| Date Handling | date-fns 3.0 |
| Notifications | react-hot-toast 2.4 |

## 📜 Scripts

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 🎨 Theme Colors

```javascript
// Dark theme palette (NO purple)
colors: {
  dark: {
    900: '#020617',  // Main background
    800: '#0B0F14',  // Cards
    700: '#111827',  // Inputs
    600: '#1f2937',  // Hover
  },
  // Accents
  cyan: '#22d3ee',
  emerald: '#10b981',
  amber: '#f59e0b',
  blue: '#3b82f6',
}
```

## 🏆 Hackathon Features

1. **Real-time Updates** - Slots update live via WebSocket
2. **Smooth UX** - Every action has animated feedback
3. **Role-based Access** - Three distinct experiences
4. **Production Ready** - Error handling, loading states, empty states
5. **Beautiful Design** - Judge-impressing dark theme

---

Built with ❤️ for hackathons
