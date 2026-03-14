import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  Building2,
  CalendarDays,
  User,
  Link2,
  Package
} from 'lucide-react';
import { classNames } from '../../utils/helpers';

const organiserLinks = [
  { name: 'Dashboard', href: '/organiser', icon: LayoutDashboard },
  { name: 'My Providers', href: '/organiser/providers', icon: Building2 },
  { name: 'Profile', href: '/organiser/profile', icon: User },
];

const providerLinks = [
  { name: 'Dashboard', href: '/provider', icon: LayoutDashboard },
  { name: 'Services', href: '/provider/appointment-types', icon: CalendarDays },
  { name: 'Availability', href: '/provider/availability', icon: Clock },
  { name: 'Bookings', href: '/provider/bookings', icon: Calendar },
  { name: 'Booking Link', href: '/provider/booking-link', icon: Link2 },
  { name: 'Profile', href: '/provider/profile', icon: User },
];

const adminLinks = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Providers', href: '/admin/providers', icon: Building2 },
  { name: 'Services', href: '/admin/services', icon: Package },
  { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
  { name: 'Profile', href: '/admin/profile', icon: User },
];

export function Sidebar({ type = 'organiser' }) {
  const location = useLocation();
  const links = type === 'admin' ? adminLinks : type === 'provider' ? providerLinks : organiserLinks;

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] bg-dark-800 border-r border-white/5 p-4">
      <nav className="space-y-1">
        {links.map((link) => {
          const isActive = location.pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              to={link.href}
              className={classNames(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative',
                isActive
                  ? 'text-white bg-gradient-to-r from-cyan-500/20 to-blue-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 w-1 h-8 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-r-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className={classNames(
                'w-5 h-5',
                isActive ? 'text-cyan-400' : ''
              )} />
              {link.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
