const analyticsService = require('../services/analytics.service');
const User = require('../models/user.model');
const Provider = require('../models/provider.model');
const Booking = require('../models/booking.model');
const AppointmentType = require('../models/appointmentType.model');
const { ok, badRequest, notFound } = require('../helpers/response.helper');

/**
 * Admin Controller - handles admin-only operations
 */

// Get platform analytics
const getPlatformAnalytics = async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const analytics = await analyticsService.getPlatformAnalytics(startDate, endDate);

    return ok(res, 'Platform analytics retrieved successfully', {
      analytics
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Get provider analytics
const getProviderAnalytics = async (req, res) => {
  const { providerId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    const analytics = await analyticsService.getProviderAnalytics(
      providerId,
      startDate,
      endDate
    );

    return ok(res, 'Provider analytics retrieved successfully', {
      providerId,
      analytics
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Get booking trends
const getBookingTrends = async (req, res) => {
  const { providerId, days = 30 } = req.query;

  try {
    const trends = await analyticsService.getBookingTrends(
      providerId || null,
      parseInt(days)
    );

    return ok(res, 'Booking trends retrieved successfully', {
      trends,
      period: `Last ${days} days`
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Get all users (with filters)
const getAllUsers = async (req, res) => {
  const { role, isActive, page = 1, limit = 20, search } = req.query;

  const query = {};

  if (role) {
    query.role = role.toUpperCase();
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  const users = await User.find(query)
    .select('-passwordHash')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  return ok(res, 'Users retrieved successfully', {
    users,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total,
      hasMore: page * limit < total
    }
  });
};

// Update user status (activate/deactivate)
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return badRequest(res, 'isActive field is required');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return notFound(res, 'User not found');
    }

    return ok(res, `User ${isActive ? 'activated' : 'deactivated'} successfully`, {
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    return badRequest(res, error.message);
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return badRequest(res, 'Role is required');
    }

    const validRoles = ['ADMIN', 'ORGANISER', 'CUSTOMER'];
    if (!validRoles.includes(role)) {
      return badRequest(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return notFound(res, 'User not found');
    }

    return ok(res, 'User role updated successfully', {
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    return badRequest(res, error.message);
  }
};

// Get system reports
const getSystemReports = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProviders,
      totalAppointmentTypes,
      totalBookings,
      activeBookings,
      recentBookings
    ] = await Promise.all([
      User.countDocuments(),
      Provider.countDocuments(),
      AppointmentType.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] } }),
      Booking.find()
        .populate('customerId', 'name email')
        .populate('providerId', 'name')
        .populate('appointmentTypeId', 'title')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    return ok(res, 'System reports retrieved successfully', {
      reports: {
        users: {
          total: totalUsers
        },
        providers: {
          total: totalProviders
        },
        appointmentTypes: {
          total: totalAppointmentTypes
        },
        bookings: {
          total: totalBookings,
          active: activeBookings
        }
      },
      recentBookings
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Update user (combined endpoint for admin)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, role, isActive } = req.body;

    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    
    if (role !== undefined) {
      const validRoles = ['ADMIN', 'ORGANISER', 'CUSTOMER'];
      const upperRole = role.toUpperCase();
      if (!validRoles.includes(upperRole)) {
        return badRequest(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
      updateData.role = upperRole;
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return notFound(res, 'User not found');
    }

    return ok(res, 'User updated successfully', {
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    return badRequest(res, error.message);
  }
};

// Get all bookings for admin
const getAllBookings = async (req, res) => {
  try {
    const { status, providerId, startDate, endDate, page = 1, limit = 100 } = req.query;

    const query = {};

    if (status) {
      query.status = status.toUpperCase();
    }

    if (providerId) {
      query.providerId = providerId;
    }

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(query)
      .populate('appointmentTypeId', 'title durationMinutes price currency')
      .populate('providerId', 'name slug')
      .populate('customerId', 'name email phone')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Booking.countDocuments(query);

    return ok(res, 'Bookings retrieved successfully', {
      bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    return badRequest(res, error.message);
  }
};

// Get all appointment types (services) for admin
const getAllAppointmentTypes = async (req, res) => {
  try {
    const { page = 1, limit = 50, providerId, published } = req.query;
    
    const query = {};
    if (providerId) query.providerId = providerId;
    if (published !== undefined) query.published = published === 'true';

    const appointmentTypes = await AppointmentType.find(query)
      .populate({
        path: 'providerId',
        select: 'name description specialization',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .populate('organiserId', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await AppointmentType.countDocuments(query);

    return ok(res, 'Appointment types retrieved successfully', {
      appointmentTypes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    console.error('Get all appointment types error:', error);
    return badRequest(res, error.message);
  }
};

// Toggle publish status of an appointment type
const toggleAppointmentTypePublish = async (req, res) => {
  try {
    const { id } = req.params;
    const { published } = req.body;

    const appointmentType = await AppointmentType.findById(id);

    if (!appointmentType) {
      return notFound(res, 'Appointment type not found');
    }

    appointmentType.published = published !== undefined ? published : !appointmentType.published;
    await appointmentType.save();

    return ok(res, `Service ${appointmentType.published ? 'published' : 'unpublished'} successfully`, {
      appointmentType
    });
  } catch (error) {
    console.error('Toggle publish error:', error);
    return badRequest(res, error.message);
  }
};

module.exports = {
  getPlatformAnalytics,
  getProviderAnalytics,
  getBookingTrends,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  updateUser,
  getSystemReports,
  getAllBookings,
  getAllAppointmentTypes,
  toggleAppointmentTypePublish
};
