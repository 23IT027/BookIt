import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Calendar, Clock, Users, CreditCard, TrendingUp, TrendingDown,
  ChevronRight, Plus, Bell, CheckCircle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { bookingAPI, providerAPI } from '../../api';
import { DashboardLayout, PageHeader } from '../../components/layout/Layout';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, formatTime, formatCurrency, classNames } from '../../utils/helpers';
import { useAuthStore } from '../../auth/authStore';

export function OrganiserDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // First get the organiser's provider
      let providerId = null;
      let providerData = null;
      try {
        const providerRes = await providerAPI.getByUser();
        providerData = providerRes.data.data?.provider || providerRes.data.provider;
        providerId = providerData?._id;
      } catch (e) {
        // No provider yet
      }

      let bookings = [];
      let statsFromApi = null;
      
      if (providerId) {
        // Fetch stats from dedicated endpoint for accurate revenue calculation
        try {
          const statsRes = await providerAPI.getStats(providerId);
          statsFromApi = statsRes.data.data?.stats || statsRes.data.stats;
        } catch (e) {
          console.log('Stats endpoint not available, calculating locally');
        }

        const bookingsRes = await bookingAPI.getProviderBookings(providerId, { limit: 1000 });
        bookings = bookingsRes.data.data?.bookings || bookingsRes.data.bookings || bookingsRes.data || [];
      }

      // If we got stats from API, use them
      if (statsFromApi) {
        setStats({
          totalBookings: statsFromApi.totalBookings,
          todayAppointments: statsFromApi.todayAppointments,
          monthlyRevenue: statsFromApi.monthlyRevenue,
          pendingBookings: statsFromApi.pendingBookings,
          todayTrend: statsFromApi.todayTrend,
          bookingsTrend: statsFromApi.bookingsTrend,
          revenueTrend: statsFromApi.revenueTrend,
        });
      } else {
        // Calculate stats locally as fallback
        const now = new Date();
        const thisMonth = bookings.filter(b => {
          const bookingDate = new Date(b.createdAt);
          return bookingDate.getMonth() === now.getMonth() && 
                 bookingDate.getFullYear() === now.getFullYear();
        });

        // Last month for comparison
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonthBookings = bookings.filter(b => {
          const bookingDate = new Date(b.createdAt);
          return bookingDate >= lastMonth && bookingDate <= lastMonthEnd;
        });

        const todayBookings = bookings.filter(b => {
          const bookingDate = new Date(b.startTime || b.slot?.date);
          return bookingDate.toDateString() === now.toDateString() && 
                 (b.status === 'CONFIRMED' || b.status?.toUpperCase() === 'CONFIRMED');
        });

        // Yesterday for comparison
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayBookings = bookings.filter(b => {
          const bookingDate = new Date(b.startTime || b.slot?.date);
          return bookingDate.toDateString() === yesterday.toDateString() && 
                 (b.status === 'CONFIRMED' || b.status?.toUpperCase() === 'CONFIRMED');
        });

        // Revenue includes confirmed/completed bookings (not just paid)
        const revenue = thisMonth.reduce((sum, b) => {
          const isConfirmedOrCompleted = 
            b.status === 'CONFIRMED' || b.status?.toUpperCase() === 'CONFIRMED' ||
            b.status === 'COMPLETED' || b.status?.toUpperCase() === 'COMPLETED' ||
            b.paymentStatus === 'PAID' || b.paymentStatus?.toUpperCase() === 'PAID';
          const amount = b.totalAmount || b.appointmentTypeId?.price || b.appointmentType?.price || 0;
          return isConfirmedOrCompleted ? sum + amount : sum;
        }, 0);

        const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => {
          const isConfirmedOrCompleted = 
            b.status === 'CONFIRMED' || b.status?.toUpperCase() === 'CONFIRMED' ||
            b.status === 'COMPLETED' || b.status?.toUpperCase() === 'COMPLETED' ||
            b.paymentStatus === 'PAID' || b.paymentStatus?.toUpperCase() === 'PAID';
          const amount = b.totalAmount || b.appointmentTypeId?.price || b.appointmentType?.price || 0;
          return isConfirmedOrCompleted ? sum + amount : sum;
        }, 0);

        // Calculate trends
        const calcTrend = (current, previous) => {
          if (previous === 0) return current > 0 ? { value: 100, isPositive: true } : null;
          const change = ((current - previous) / previous) * 100;
          return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
        };

        setStats({
          totalBookings: bookings.length,
          todayAppointments: todayBookings.length,
          monthlyRevenue: revenue,
          pendingBookings: bookings.filter(b => 
            b.status === 'PENDING' || b.status?.toUpperCase() === 'PENDING'
          ).length,
          // Trends
          todayTrend: calcTrend(todayBookings.length, yesterdayBookings.length),
          bookingsTrend: calcTrend(thisMonth.length, lastMonthBookings.length),
          revenueTrend: calcTrend(revenue, lastMonthRevenue),
        });
      }

      // Sort by most recent first and take top 5
      const sortedBookings = [...bookings].sort((a, b) => 
        new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt)
      );
      setRecentBookings(sortedBookings.slice(0, 5));

      // Generate chart data (last 7 days based on when bookings were CREATED)
      const last7Days = [...Array(7)].map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayBookings = bookings.filter(b => {
          const createdAt = new Date(b.createdAt);
          return createdAt >= date && createdAt < nextDate;
        });
        
        const dayRevenue = dayBookings.reduce((sum, b) => {
          const amount = b.totalAmount || b.appointmentTypeId?.price || b.appointmentType?.price || 0;
          return sum + amount;
        }, 0);
        
        return {
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          bookings: dayBookings.length,
          revenue: dayRevenue,
        };
      });
      
      console.log('Chart data generated:', last7Days);
      console.log('Total bookings:', bookings.length);
      setChartData(last7Days);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'Organiser'}`}
        subtitle="Here's what's happening with your business today"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="w-10 h-10 rounded-xl mb-4" />
              <Skeleton className="w-16 h-8 mb-2" />
              <Skeleton className="w-24 h-4" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Today's Appointments"
              value={stats?.todayAppointments || 0}
              icon={Calendar}
              trend={stats?.todayTrend}
              color="cyan"
            />
            <StatCard
              title="Total Bookings"
              value={stats?.totalBookings || 0}
              icon={Users}
              trend={stats?.bookingsTrend}
              color="emerald"
            />
            <StatCard
              title="Monthly Revenue"
              value={formatCurrency(stats?.monthlyRevenue || 0)}
              icon={CreditCard}
              trend={stats?.revenueTrend}
              color="blue"
            />
            <StatCard
              title="Pending"
              value={stats?.pendingBookings || 0}
              icon={Clock}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Chart and recent bookings */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-white">Booking Trends</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-gray-400">Bookings</span>
                </div>
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="w-full h-64" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="bookingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="bookings" 
                      stroke="#22d3ee" 
                      strokeWidth={2}
                      fill="url(#bookingGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Recent bookings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Recent Bookings</h3>
              <Link to="/organiser/bookings" className="text-sm text-cyan-400 hover:text-cyan-300">
                View all
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="w-32 h-4 mb-1" />
                      <Skeleton className="w-24 h-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No recent bookings</p>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <div 
                    key={booking._id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {booking.appointmentTypeId?.title || booking.appointmentType?.name || 'Appointment'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {booking.startTime ? format(new Date(booking.startTime), 'MMM d, yyyy • h:mm a') : 'No date'}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link to="/organiser/providers">
              <Button variant="secondary" className="w-full justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Manage Provider
              </Button>
            </Link>
            <Link to="/organiser/appointment-types">
              <Button variant="secondary" className="w-full justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Manage Services
              </Button>
            </Link>
            <Link to="/organiser/availability">
              <Button variant="secondary" className="w-full justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Set Availability
              </Button>
            </Link>
            <Link to="/organiser/bookings">
              <Button variant="secondary" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                View Bookings
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default OrganiserDashboard;
