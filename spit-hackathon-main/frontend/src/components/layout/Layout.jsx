import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../auth/authStore';
import { EmailVerificationBanner } from '../ui/EmailVerificationBanner';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <EmailVerificationBanner />
      <main className="pt-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}

export function DashboardLayout() {
  const { user } = useAuthStore();
  const type = user?.role?.toUpperCase() === 'ADMIN' ? 'admin' : 'organiser';
  
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <EmailVerificationBanner />
      <div className="flex pt-16">
        <Sidebar type={type} />
        <main className="flex-1 p-8 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && (
          <p className="text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
