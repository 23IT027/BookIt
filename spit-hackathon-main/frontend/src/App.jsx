import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import { MainLayout, DashboardLayout } from './components/layout/Layout';

// Auth
import { useAuthStore } from './auth/authStore';

// Pages
import { LandingPage } from './pages/Landing';
import { LoginPage, SignupPage, VerifyOTPPage } from './pages/auth';
import { ProviderList, ProviderDetail, MyBookings } from './pages/customer';
import { 
  OrganiserDashboard, 
  ProviderManagement, 
  AppointmentTypeManagement,
  AvailabilityEditor,
  BookingManagement,
  BookingLinkSettings
} from './pages/organiser';
import { AdminDashboard, UserManagement, AdminProviderManagement, AdminBookingManagement, ServiceManagement } from './pages/admin';
import { PaymentSuccess, PaymentCancel } from './pages/payment';
import { ProfilePage } from './pages/shared';
import { PublicBookingPage, PrivateBookingPage } from './pages/booking';

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role?.toUpperCase();
  const normalizedAllowedRoles = allowedRoles.map(r => r.toUpperCase());
  
  if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children || <Outlet />;
}

// Public Route wrapper (redirect if already authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Dashboard router based on role
function DashboardRouter() {
  const { user } = useAuthStore();
  const role = user?.role?.toUpperCase();

  switch (role) {
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'ORGANISER':
      return <Navigate to="/organiser" replace />;
    case 'CUSTOMER':
    default:
      return <Navigate to="/my-bookings" replace />;
  }
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, []); // Only run once on mount

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Public booking page (like cal.com) */}
        <Route path="/book/:slug" element={<PublicBookingPage />} />
        
        {/* Private booking page (accessible via unique token) */}
        <Route path="/private-booking/:token" element={<PrivateBookingPage />} />
        
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        
        <Route path="/signup" element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        } />
        
        <Route path="/verify-otp" element={<VerifyOTPPage />} />

        {/* Provider browsing (public) */}
        <Route path="/providers" element={<MainLayout />}>
          <Route index element={<ProviderList />} />
          <Route path=":id" element={<ProviderDetail />} />
        </Route>

        {/* Dashboard redirect */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        } />

        {/* Customer routes */}
        <Route path="/my-bookings" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<MyBookings />} />
        </Route>

        {/* Customer profile */}
        <Route path="/profile" element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ProfilePage />} />
        </Route>

        {/* Organiser routes */}
        <Route path="/organiser" element={
          <ProtectedRoute allowedRoles={['ORGANISER']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OrganiserDashboard />} />
          <Route path="providers" element={<ProviderManagement />} />
          <Route path="appointment-types" element={<AppointmentTypeManagement />} />
          <Route path="availability" element={<AvailabilityEditor />} />
          <Route path="bookings" element={<BookingManagement />} />
          <Route path="booking-link" element={<BookingLinkSettings />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="providers" element={<AdminProviderManagement />} />
          <Route path="bookings" element={<AdminBookingManagement />} />
          <Route path="services" element={<ServiceManagement />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Payment routes */}
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="/booking/success" element={<PaymentSuccess />} />
        <Route path="/booking/cancel" element={<PaymentCancel />} />

        {/* 404 - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
