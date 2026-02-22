const Booking = require('../models/booking.model');
const Payment = require('../models/payment.model');
const User = require('../models/user.model');
const Provider = require('../models/provider.model');
const AppointmentType = require('../models/appointmentType.model');

/**
 * Analytics and reporting service
 */

class AnalyticsService {
  /**
   * Get overall platform analytics
   */
  async getPlatformAnalytics(startDate = null, endDate = null) {
    const dateFilter = this.getDateFilter(startDate, endDate);

    // Get current period stats
    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      pendingBookings,
      completedBookings,
      totalRevenue,
      totalUsers,
      totalProviders,
      totalAppointmentTypes
    ] = await Promise.all([
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({ ...dateFilter, status: 'CONFIRMED' }),
      Booking.countDocuments({ ...dateFilter, status: 'CANCELLED' }),
      Booking.countDocuments({ ...dateFilter, status: 'PENDING' }),
      Booking.countDocuments({ ...dateFilter, status: 'COMPLETED' }),
      this.getTotalRevenue(dateFilter),
      User.countDocuments(),
      Provider.countDocuments(),
      AppointmentType.countDocuments()
    ]);

    // Get last month stats for trend comparison
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthFilter = {
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    };

    const [
      lastMonthBookings,
      lastMonthRevenue,
      lastMonthUsers,
      lastMonthProviders
    ] = await Promise.all([
      Booking.countDocuments(lastMonthFilter),
      this.getTotalRevenue(lastMonthFilter),
      User.countDocuments({ createdAt: { $lte: lastMonthEnd } }),
      Provider.countDocuments({ createdAt: { $lte: lastMonthEnd } })
    ]);

    const cancellationRate = totalBookings > 0 
      ? ((cancelledBookings / totalBookings) * 100).toFixed(2)
      : 0;

    // Calculate trends
    const calcTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        pending: pendingBookings,
        completed: completedBookings,
        cancellationRate: parseFloat(cancellationRate)
      },
      revenue: totalRevenue,
      users: {
        total: totalUsers,
        providers: totalProviders
      },
      appointmentTypes: totalAppointmentTypes,
      trends: {
        bookings: calcTrend(totalBookings, lastMonthBookings),
        revenue: calcTrend(totalRevenue || 0, lastMonthRevenue || 0),
        users: calcTrend(totalUsers, lastMonthUsers),
        providers: calcTrend(totalProviders, lastMonthProviders)
      },
      period: {
        startDate,
        endDate
      }
    };
  }

  /**
   * Get provider analytics
   */
  async getProviderAnalytics(providerId, startDate = null, endDate = null) {
    const dateFilter = this.getDateFilter(startDate, endDate);
    const filter = { ...dateFilter, providerId };

    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      totalRevenue,
      busiestHours
    ] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.countDocuments({ ...filter, status: 'CONFIRMED' }),
      Booking.countDocuments({ ...filter, status: 'CANCELLED' }),
      Booking.countDocuments({ ...filter, status: 'COMPLETED' }),
      this.getProviderRevenue(providerId, dateFilter),
      this.getBusiestHours(providerId, dateFilter)
    ]);

    return {
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        completed: completedBookings
      },
      revenue: totalRevenue,
      busiestHours,
      period: {
        startDate,
        endDate
      }
    };
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(customerId, startDate = null, endDate = null) {
    const dateFilter = this.getDateFilter(startDate, endDate);
    const filter = { ...dateFilter, customerId };

    const [
      totalBookings,
      upcomingBookings,
      completedBookings,
      cancelledBookings,
      totalSpent
    ] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.countDocuments({ 
        customerId, 
        status: 'CONFIRMED',
        startTime: { $gte: new Date() }
      }),
      Booking.countDocuments({ ...filter, status: 'COMPLETED' }),
      Booking.countDocuments({ ...filter, status: 'CANCELLED' }),
      this.getCustomerSpending(customerId, dateFilter)
    ]);

    return {
      bookings: {
        total: totalBookings,
        upcoming: upcomingBookings,
        completed: completedBookings,
        cancelled: cancelledBookings
      },
      totalSpent,
      period: {
        startDate,
        endDate
      }
    };
  }

  /**
   * Get busiest hours for a provider
   */
  async getBusiestHours(providerId, dateFilter = {}) {
    const filter = { ...dateFilter, providerId, status: { $nin: ['CANCELLED'] } };

    const bookings = await Booking.find(filter).select('startTime');

    const hourCounts = {};

    bookings.forEach(booking => {
      const hour = new Date(booking.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Convert to array and sort by count
    const busiestHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        timeSlot: `${hour}:00 - ${parseInt(hour) + 1}:00`,
        bookingCount: count
      }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    return busiestHours;
  }

  /**
   * Get total revenue
   */
  async getTotalRevenue(dateFilter = {}) {
    const payments = await Payment.aggregate([
      {
        $match: {
          status: 'SUCCEEDED',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return payments.length > 0 ? payments[0].total : 0;
  }

  /**
   * Get provider revenue
   */
  async getProviderRevenue(providerId, dateFilter = {}) {
    const bookings = await Booking.find({
      providerId,
      paymentStatus: 'PAID',
      ...dateFilter
    }).select('_id');

    const bookingIds = bookings.map(b => b._id);

    const payments = await Payment.aggregate([
      {
        $match: {
          bookingId: { $in: bookingIds },
          status: 'SUCCEEDED'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return payments.length > 0 ? payments[0].total : 0;
  }

  /**
   * Get customer spending
   */
  async getCustomerSpending(customerId, dateFilter = {}) {
    const payments = await Payment.aggregate([
      {
        $match: {
          customerId,
          status: 'SUCCEEDED',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return payments.length > 0 ? payments[0].total : 0;
  }

  /**
   * Get booking trends (by day)
   */
  async getBookingTrends(providerId = null, days = 30) {
    // Helper to get local date string (YYYY-MM-DD)
    const getLocalDateStr = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Start from (days - 1) ago to include today
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const filter = {
      createdAt: { $gte: startDate },
      status: { $nin: ['CANCELLED'] }
    };

    if (providerId) {
      filter.providerId = providerId;
    }

    const trends = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Create a map of existing data
    const trendMap = {};
    trends.forEach(t => {
      const dateStr = `${t._id.year}-${String(t._id.month).padStart(2, '0')}-${String(t._id.day).padStart(2, '0')}`;
      trendMap[dateStr] = t.count;
    });

    // Fill in all days in the range (from startDate to today)
    const result = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = getLocalDateStr(date);
      result.push({
        date: dateStr,
        bookings: trendMap[dateStr] || 0
      });
    }

    return result;
  }

  /**
   * Helper to create date filter
   */
  getDateFilter(startDate, endDate) {
    const filter = {};

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      filter.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.createdAt = { $lte: new Date(endDate) };
    }

    return filter;
  }
}

module.exports = new AnalyticsService();
