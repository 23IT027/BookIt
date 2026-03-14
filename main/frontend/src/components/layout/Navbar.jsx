import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  Calendar, 
  User, 
  LogOut, 
  ChevronDown,
  Bell,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuthStore } from '../../auth/authStore';
import { useSocket } from '../../socket/useSocket';
import { classNames } from '../../utils/helpers';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = isAuthenticated ? [
    { name: 'Browse Providers', href: '/providers', roles: ['CUSTOMER'] },
    { name: 'My Bookings', href: '/my-bookings', roles: ['CUSTOMER'] },
    { name: 'Organiser', href: '/organiser', roles: ['ORGANISER'] },
    { name: 'Provider', href: '/provider', roles: ['PROVIDER'] },
    { name: 'Admin', href: '/admin', roles: ['ADMIN'] },
  ].filter(link => !link.roles || link.roles.includes(user?.role)) : [];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">BookFlow</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={classNames(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  location.pathname === link.href
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Connection status */}
            {isAuthenticated && (
              <div className="hidden sm:flex items-center gap-2">

              </div>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.role}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-dark-800 border border-white/10 rounded-xl shadow-xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-white/5">
                        <p className="text-sm font-medium text-white">{user?.name}</p>
                        <p className="text-xs text-gray-400">{user?.email}</p>
                      </div>
                      <div className="p-2">
                        <Link
                          to={
                            user?.role?.toUpperCase() === 'ADMIN' ? '/admin/profile' :
                            user?.role?.toUpperCase() === 'ORGANISER' ? '/organiser/profile' :
                            user?.role?.toUpperCase() === 'PROVIDER' ? '/provider/profile' :
                            '/profile'
                          }
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Profile
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn-primary text-sm"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 text-gray-300" />
              ) : (
                <Menu className="w-6 h-6 text-gray-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/5"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={classNames(
                    'block px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    location.pathname === link.href
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
