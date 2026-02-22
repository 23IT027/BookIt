import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Calendar, CreditCard, Building2
} from 'lucide-react';
import { 
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { adminAPI, bookingAPI, providerAPI } from '../../api';
import { PageHeader } from '../../components/layout/Layout';
import { Card, StatCard } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency } from '../../utils/helpers';

const COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch analytics
      const response = await adminAPI.getAnalytics();
      const data = response.data.data?.analytics || response.data.analytics || response.data.data || response.data;
      
      console.log('Analytics data:', data);
      
      // Extract trends from API response
      const trends = data.trends || {};
      
      setStats({
        totalUsers: data.totalUsers || data.users?.total || 0,
        totalProviders: data.totalProviders || data.providers?.total || data.users?.providers || 0,
        totalBookings: data.totalBookings || data.bookings?.total || 0,
        totalRevenue: data.totalRevenue || data.revenue || 0,
        activeUsers: data.activeUsers || 0,
        pendingBookings: data.pendingBookings || data.bookings?.pending || 0,
        confirmedBookings: data.bookings?.confirmed || 0,
        cancelledBookings: data.bookings?.cancelled || 0,
        completedBookings: data.bookings?.completed || 0,
        // Trends from API
        usersTrend: trends.users !== undefined ? { value: Math.abs(trends.users), isPositive: trends.users >= 0 } : null,
        providersTrend: trends.providers !== undefined ? { value: Math.abs(trends.providers), isPositive: trends.providers >= 0 } : null,
        bookingsTrend: trends.bookings !== undefined ? { value: Math.abs(trends.bookings), isPositive: trends.bookings >= 0 } : null,
        revenueTrend: trends.revenue !== undefined ? { value: Math.abs(trends.revenue), isPositive: trends.revenue >= 0 } : null,
      });

      // Try to fetch booking trends from backend
      let chartDataSet = false;
      try {
        const trendsResponse = await adminAPI.getTrends(7); // Fetch last 7 days
        const trendsData = trendsResponse.data.data?.trends || trendsResponse.data.trends || [];
        console.log('Trends data from API:', trendsData);
        
        if (Array.isArray(trendsData) && trendsData.length > 0) {
          // Format trends data for chart
          const formattedData = trendsData.map(t => ({
            day: new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
            bookings: t.bookings || t.count || 0,
            revenue: t.revenue || 0,
          }));
          console.log('Formatted chart data:', formattedData);
          setChartData(formattedData);
          chartDataSet = true;
        }
      } catch (e) {
        console.log('Trends API error:', e.message);
      }

      // Fallback: Fetch all bookings and compute trends client-side
      if (!chartDataSet) {
        try {
          // Try admin API first
          let allBookings = [];
          try {
            const bookingsRes = await adminAPI.getAllBookings();
            allBookings = bookingsRes.data.data?.bookings || bookingsRes.data.bookings || [];
          } catch (adminErr) {
            // Fallback to fetching from all providers
            const providersRes = await providerAPI.getAll();
            const providersData = providersRes.data.data?.providers || providersRes.data.providers || [];
            for (const provider of providersData) {
              try {
                const bookingsRes = await bookingAPI.getProviderBookings(provider._id);
                const providerBookings = bookingsRes.data.data?.bookings || bookingsRes.data.bookings || [];
                allBookings = [...allBookings, ...providerBookings];
              } catch (e) {}
            }
          }
          
          console.log('All bookings for chart:', allBookings.length);
          
          // Generate chart data from bookings
          const generatedData = generateChartDataFromBookings(allBookings);
          console.log('Generated chart data from bookings:', generatedData);
          setChartData(generatedData);
        } catch (err) {
          console.log('Fallback booking fetch error:', err.message);
          setChartData(generateLast7DaysData([]));
        }
      }
      
      setRecentActivity(data.recentActivity || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Use sample data for demo
      setStats({
        totalUsers: 0,
        totalProviders: 0,
        totalBookings: 0,
        totalRevenue: 0,
        activeUsers: 0,
        pendingBookings: 0,
      });
      setChartData(generateSampleChartData());
    } finally {
      setIsLoading(false);
    }
  };

  const generateLast7DaysData = (bookingsByDate = []) => {
    // Generate last 7 days with real data if available
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      // Find matching data from bookingsByDate
      const dayData = bookingsByDate.find(d => d.date === dateStr);
      
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        bookings: dayData?.count || dayData?.bookings || 0,
        revenue: dayData?.revenue || 0,
      });
    }
    return days;
  };

  const generateSampleChartData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        bookings: 0,
        revenue: 0,
      });
    }
    return days;
  };

  // Generate chart data from actual bookings array
  const generateChartDataFromBookings = (bookings = []) => {
    // Helper to get local date string (YYYY-MM-DD)
    const getLocalDateStr = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Create a map of dates to booking counts
    const dateCountMap = {};
    
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = getLocalDateStr(date);
      dateCountMap[dateStr] = { count: 0, revenue: 0 };
    }
    
    console.log('Date map keys:', Object.keys(dateCountMap));
    
    // Count bookings per day
    bookings.forEach(booking => {
      const bookingDate = new Date(booking.createdAt || booking.startTime);
      const dateStr = getLocalDateStr(bookingDate);
      
      console.log('Booking date:', dateStr, 'exists in map:', !!dateCountMap[dateStr]);
      
      if (dateCountMap[dateStr]) {
        dateCountMap[dateStr].count += 1;
        if (booking.status !== 'CANCELLED') {
          dateCountMap[dateStr].revenue += booking.totalAmount || booking.appointmentTypeId?.price || 0;
        }
      }
    });
    
    console.log('Final date counts:', dateCountMap);
    
    // Convert to array format for chart
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = getLocalDateStr(date);
      
      result.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        bookings: dateCountMap[dateStr]?.count || 0,
        revenue: dateCountMap[dateStr]?.revenue || 0,
      });
    }
    
    return result;
  };

  // Generate pie chart data from real stats
  const pieData = stats ? [
    { name: 'Confirmed', value: stats.confirmedBookings || 0, color: '#10b981' },
    { name: 'Pending', value: stats.pendingBookings || 0, color: '#f59e0b' },
    { name: 'Cancelled', value: stats.cancelledBookings || 0, color: '#ef4444' },
    { name: 'Completed', value: stats.completedBookings || 0, color: '#22d3ee' },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Dashboard"
        subtitle="System overview and analytics"
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
              title="Total Users"
              value={stats?.totalUsers || 0}
              icon={Users}
              trend={stats?.usersTrend}
              color="cyan"
            />
            <StatCard
              title="Total Providers"
              value={stats?.totalProviders || 0}
              icon={Building2}
              trend={stats?.providersTrend}
              color="emerald"
            />
            <StatCard
              title="Total Bookings"
              value={stats?.totalBookings || 0}
              icon={Calendar}
              trend={stats?.bookingsTrend}
              color="blue"
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats?.totalRevenue || 0)}
              icon={CreditCard}
              trend={stats?.revenueTrend}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Booking trends chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="p-5">
            <h3 className="font-semibold text-white mb-6">Booking Trends</h3>
            
            {isLoading ? (
              <Skeleton className="w-full h-64" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="bookingGradientAdmin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="bookings" 
                      stroke="#22d3ee" 
                      strokeWidth={2}
                      fill="url(#bookingGradientAdmin)"
                      name="Bookings"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Booking status pie chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-5 h-full">
            <h3 className="font-semibold text-white mb-6">Booking Status</h3>
            
            {isLoading ? (
              <Skeleton className="w-full h-48" />
            ) : pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-gray-400 text-sm">No bookings yet</p>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend */}
            {pieData.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="text-xs text-gray-400">{item.name}</span>
                    <span className="text-xs text-white ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

    </div>
  );
}

export default AdminDashboard;
