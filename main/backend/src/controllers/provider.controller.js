const Provider = require('../models/provider.model');
const Booking = require('../models/booking.model');
const Payment = require('../models/payment.model');
const AppointmentType = require('../models/appointmentType.model');
const { created, ok, notFound, badRequest, forbidden } = require('../helpers/response.helper');

/**
 * Provider Controller - handles provider operations
 */

// Create provider
const createProvider = async (req, res) => {
  const { name, description, specialization, timezone, contactEmail, contactPhone, address } = req.body;
  const userId = req.user._id;

  // Check if provider already exists for this user
  const existingProvider = await Provider.findOne({ userId });

  if (existingProvider) {
    return badRequest(res, 'Provider profile already exists for this user');
  }

  // Create provider
  const provider = await Provider.create({
    name,
    userId,
    description,
    specialization,
    timezone: timezone || 'UTC',
    contactEmail,
    contactPhone,
    address
  });

  return created(res, 'Provider created successfully', {
    provider
  });
};

// Get all providers
const getAllProviders = async (req, res) => {
  const { page = 1, limit = 10, search, specialization, isActive, includeInactive } = req.query;

  const query = {};

  // Search filter
  if (search) {
    query.$text = { $search: search };
  }

  // Specialization filter
  if (specialization) {
    query.specialization = new RegExp(specialization, 'i');
  }

  // Active filter
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  let providers = await Provider.find(query)
    .populate('userId', 'name email isActive')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  // Filter out providers with deactivated users (unless admin requests all with includeInactive=true)
  if (includeInactive !== 'true') {
    providers = providers.filter(p => p.userId?.isActive !== false);
  }

  const total = await Provider.countDocuments(query);

  return ok(res, 'Providers retrieved successfully', {
    providers,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalProviders: total,
      hasMore: page * limit < total
    }
  });
};

// Get provider by ID
const getProviderById = async (req, res) => {
  const { id } = req.params;

  const provider = await Provider.findById(id)
    .populate('userId', 'name email phone');

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  return ok(res, 'Provider retrieved successfully', {
    provider
  });
};

// Get provider by user ID
const getProviderByUserId = async (req, res) => {
  const userId = (req.params.userId && req.params.userId !== 'me') ? req.params.userId : req.user._id;

  const provider = await Provider.findOne({ userId })
    .populate('userId', 'name email phone');

  if (!provider) {
    return notFound(res, 'Provider not found for this user');
  }

  // Get appointment types count for this provider
  const appointmentTypes = await AppointmentType.find({ providerId: provider._id }).select('_id');

  return ok(res, 'Provider retrieved successfully', {
    provider: {
      ...provider.toObject(),
      appointmentTypes
    }
  });
};

// Update provider
const updateProvider = async (req, res) => {
  const { id } = req.params;
  const { 
    name, description, specialization, timezone, contactEmail, contactPhone, address, isActive,
    bookingSlug, publicBookingEnabled 
  } = req.body;

  const provider = await Provider.findById(id);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  // Check ownership (only provider owner or admin can update)
  if (req.user.role !== 'ADMIN' && provider.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only update your own provider profile');
  }

  // Update fields
  if (name !== undefined) provider.name = name;
  if (description !== undefined) provider.description = description;
  if (specialization !== undefined) provider.specialization = specialization;
  if (timezone !== undefined) provider.timezone = timezone;
  if (contactEmail !== undefined) provider.contactEmail = contactEmail;
  if (contactPhone !== undefined) provider.contactPhone = contactPhone;
  if (address !== undefined) provider.address = address;
  if (isActive !== undefined && req.user.role === 'ADMIN') {
    provider.isActive = isActive;
  }

  // Booking slug updates
  if (bookingSlug !== undefined) {
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    const cleanSlug = bookingSlug.toLowerCase().trim();
    
    if (cleanSlug && !slugRegex.test(cleanSlug)) {
      return badRequest(res, 'Booking slug can only contain lowercase letters, numbers, and hyphens');
    }
    
    if (cleanSlug && cleanSlug.length < 3) {
      return badRequest(res, 'Booking slug must be at least 3 characters');
    }
    
    // Check if slug is already taken (by another provider)
    if (cleanSlug) {
      const existingProvider = await Provider.findOne({ 
        bookingSlug: cleanSlug,
        _id: { $ne: provider._id }
      });
      
      if (existingProvider) {
        return badRequest(res, 'This booking link is already taken');
      }
    }
    
    provider.bookingSlug = cleanSlug || null;
  }
  
  if (publicBookingEnabled !== undefined) {
    provider.publicBookingEnabled = publicBookingEnabled;
  }

  await provider.save();

  return ok(res, 'Provider updated successfully', {
    provider
  });
};

// Delete provider
const deleteProvider = async (req, res) => {
  const { id } = req.params;

  const provider = await Provider.findById(id);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && provider.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only delete your own provider profile');
  }

  // Hard delete - actually remove from database
  await Provider.findByIdAndDelete(id);

  return ok(res, 'Provider permanently deleted from database');
};

// Get provider analytics/stats
const getProviderStats = async (req, res) => {
  const { id } = req.params;

  const provider = await Provider.findById(id);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && provider.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only view stats for your own provider');
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Get all bookings for this provider
  const allBookings = await Booking.find({ providerId: id })
    .populate('appointmentTypeId', 'title price currency');

  // This month bookings
  const thisMonthBookings = allBookings.filter(b => {
    const bookingDate = new Date(b.createdAt);
    return bookingDate >= startOfMonth && bookingDate <= endOfMonth;
  });

  // Last month bookings
  const lastMonthBookings = allBookings.filter(b => {
    const bookingDate = new Date(b.createdAt);
    return bookingDate >= startOfLastMonth && bookingDate <= endOfLastMonth;
  });

  // Today's appointments
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  const todayAppointments = allBookings.filter(b => {
    const startTime = new Date(b.startTime);
    return startTime >= todayStart && startTime <= todayEnd && 
           (b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  });

  // Yesterday's appointments for comparison
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  
  const yesterdayAppointments = allBookings.filter(b => {
    const startTime = new Date(b.startTime);
    return startTime >= yesterdayStart && startTime <= yesterdayEnd && 
           (b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  });

  // Calculate revenue from payments
  const bookingIds = thisMonthBookings.map(b => b._id);
  const payments = await Payment.find({
    bookingId: { $in: bookingIds },
    status: 'SUCCEEDED'
  });
  const paymentsRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calculate from booking prices for bookings marked as PAID
  const paidBookingsRevenue = thisMonthBookings
    .filter(b => b.paymentStatus === 'PAID')
    .reduce((sum, b) => sum + (b.appointmentTypeId?.price || 0), 0);

  // Also calculate potential revenue from CONFIRMED/COMPLETED bookings (for services that collect payment at time of service)
  const confirmedBookingsRevenue = thisMonthBookings
    .filter(b => ['CONFIRMED', 'COMPLETED'].includes(b.status) && b.paymentStatus !== 'REFUNDED')
    .reduce((sum, b) => sum + (b.appointmentTypeId?.price || 0), 0);

  // Use the highest value - prioritize actual payments, then paid status, then confirmed bookings
  const totalMonthlyRevenue = Math.max(paymentsRevenue, paidBookingsRevenue, confirmedBookingsRevenue);

  // Last month revenue - same logic
  const lastMonthBookingIds = lastMonthBookings.map(b => b._id);
  const lastMonthPayments = await Payment.find({
    bookingId: { $in: lastMonthBookingIds },
    status: 'SUCCEEDED'
  });
  const lastMonthPaymentsRevenue = lastMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const lastMonthPaidBookingsRevenue = lastMonthBookings
    .filter(b => b.paymentStatus === 'PAID')
    .reduce((sum, b) => sum + (b.appointmentTypeId?.price || 0), 0);
  const lastMonthConfirmedRevenue = lastMonthBookings
    .filter(b => ['CONFIRMED', 'COMPLETED'].includes(b.status) && b.paymentStatus !== 'REFUNDED')
    .reduce((sum, b) => sum + (b.appointmentTypeId?.price || 0), 0);
  const totalLastMonthRevenue = Math.max(lastMonthPaymentsRevenue, lastMonthPaidBookingsRevenue, lastMonthConfirmedRevenue);

  // Pending bookings
  const pendingBookings = allBookings.filter(b => b.status === 'PENDING');

  // Calculate trends
  const calcTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? { value: 100, isPositive: true } : null;
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
  };

  return ok(res, 'Provider stats retrieved successfully', {
    stats: {
      totalBookings: allBookings.length,
      todayAppointments: todayAppointments.length,
      monthlyRevenue: totalMonthlyRevenue,
      pendingBookings: pendingBookings.length,
      thisMonthBookings: thisMonthBookings.length,
      // Trends
      todayTrend: calcTrend(todayAppointments.length, yesterdayAppointments.length),
      bookingsTrend: calcTrend(thisMonthBookings.length, lastMonthBookings.length),
      revenueTrend: calcTrend(totalMonthlyRevenue, totalLastMonthRevenue)
    }
  });
};

module.exports = {
  createProvider,
  getAllProviders,
  getProviderById,
  getProviderByUserId,
  updateProvider,
  deleteProvider,
  getProviderStats
};
