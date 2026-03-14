import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Calendar, Clock, Users, CreditCard,
  ChevronRight, Plus, CheckCircle, XCircle
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
  const [allBookings, setAllBookings] = useState([]);
  const [isUpdatingId, setIsUpdatingId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const basePath = (user?.role?.toUpperCase() === 'PROVIDER') ? '/provider' : '/organiser';

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

      setAllBookings(Array.isArray(bookings) ? bookings : []);

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

  const handleQuickRequestAction = async (booking, action) => {
    if (!booking?._id) return;
    setIsUpdatingId(booking._id);
    try {
      if (action === 'approve') {
        await bookingAPI.updateStatus(booking._id, 'CONFIRMED');
      } else if (action === 'reject') {
        await bookingAPI.updateStatus(booking._id, 'CANCELLED');
      }
      await fetchDashboardData();
    } catch (error) {
      console.error('Failed to update booking from dashboard:', error);
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'Provider'}`}
        subtitle="Here's what's happening with your bookings today"
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
              title="Approved Today"
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
              title="Pending Requests"
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

        {/* Recent booking requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Recent Requests</h3>
              <Link to={`${basePath}/bookings`} className="text-sm text-cyan-400 hover:text-cyan-300">
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
            ) : (() => {
              const pending = (allBookings || [])
                .filter(b => (b.status || '').toUpperCase() === 'PENDING')
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

              if (pending.length === 0) {
                return (
                  <p className="text-gray-500 text-sm text-center py-8">
                    No pending requests right now
                  </p>
                );
              }

              return (
                <div className="space-y-3">
                  {pending.map((booking) => (
                    <div 
                      key={booking._id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {booking.customerId?.name || booking.guestInfo?.name || 'Customer'} •{' '}
                          {booking.appointmentTypeId?.title || booking.appointmentType?.name || 'Service'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {booking.startTime
                            ? format(new Date(booking.startTime), 'MMM d, yyyy • h:mm a')
                            : 'No date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuickRequestAction(booking, 'approve')}
                          disabled={isUpdatingId === booking._id}
                          className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleQuickRequestAction(booking, 'reject')}
                          disabled={isUpdatingId === booking._id}
                          className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </motion.div>
      </div>

      {/* Upcoming confirmed bookings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Upcoming Confirmed Bookings</h3>
            <span className="text-xs text-gray-400">
              Next 7 days
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="w-full h-20" />
          ) : (() => {
            const now = new Date();
            const inSevenDays = new Date();
            inSevenDays.setDate(inSevenDays.getDate() + 7);
            const upcoming = (allBookings || [])
              .filter(b => {
                const status = (b.status || '').toUpperCase();
                const start = b.startTime ? new Date(b.startTime) : null;
                return status === 'CONFIRMED' && start && start > now && start <= inSevenDays;
              })
              .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
              .slice(0, 10);

            if (upcoming.length === 0) {
              return (
                <p className="text-gray-500 text-sm text-center py-4">
                  No confirmed bookings in the next 7 days
                </p>
              );
            }

            return (
              <div className="space-y-2">
                {upcoming.map((booking) => (
                  <div
                    key={booking._id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {booking.appointmentTypeId?.title || booking.appointmentType?.name || 'Service'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {booking.startTime
                          ? format(new Date(booking.startTime), 'EEE, MMM d • h:mm a')
                          : 'No date'}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-5">
          <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link to={`${basePath}/providers`}>
              <Button variant="secondary" className="w-full justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Manage Provider
              </Button>
            </Link>
            <Link to={`${basePath}/appointment-types`}>
              <Button variant="secondary" className="w-full justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Manage Services
              </Button>
            </Link>
            <Link to={`${basePath}/availability`}>
              <Button variant="secondary" className="w-full justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Set Availability
              </Button>
            </Link>
            <Link to={`${basePath}/bookings`}>
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
