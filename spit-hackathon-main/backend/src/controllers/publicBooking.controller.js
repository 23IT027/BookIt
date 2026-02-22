const Booking = require('../models/booking.model');
const AppointmentType = require('../models/appointmentType.model');
const Provider = require('../models/provider.model');
const slotService = require('../services/slot.service');
const redisLockService = require('../services/redisLock.service');
const emailService = require('../services/email.service');
const calendarService = require('../services/calendar.service');
const { created, ok, notFound, badRequest, conflict } = require('../helpers/response.helper');
const { addMinutes, isPast, getStartOfDay, getEndOfDay } = require('../helpers/date.helper');

/**
 * Public Booking Controller - handles unauthenticated booking operations
 * For public booking links like cal.com
 */

// Get provider by booking slug (public)
const getProviderBySlug = async (req, res) => {
  const { slug } = req.params;

  const provider = await Provider.findOne({ 
    bookingSlug: slug.toLowerCase(),
    isActive: true,
    publicBookingEnabled: true
  }).populate('userId', 'name email');

  if (!provider) {
    return notFound(res, 'Booking page not found or is not available');
  }

  return ok(res, 'Provider retrieved successfully', {
    provider: {
      _id: provider._id,
      name: provider.name,
      description: provider.description,
      specialization: provider.specialization,
      bookingSlug: provider.bookingSlug,
      avatar: provider.avatar,
      contactEmail: provider.contactEmail,
      contactPhone: provider.contactPhone,
      address: provider.address,
      timezone: provider.timezone
    }
  });
};

// Get appointment types for public booking
const getPublicAppointmentTypes = async (req, res) => {
  const { slug } = req.params;

  const provider = await Provider.findOne({ 
    bookingSlug: slug.toLowerCase(),
    isActive: true,
    publicBookingEnabled: true
  });

  if (!provider) {
    return notFound(res, 'Booking page not found');
  }

  // Exclude private services from public listing
  const appointmentTypes = await AppointmentType.find({
    providerId: provider._id,
    published: true,
    isPrivate: { $ne: true }
  }).select('title description durationMinutes price currency images questions hasResources resources');

  return ok(res, 'Appointment types retrieved successfully', {
    appointmentTypes
  });
};

// Get available slots for public booking
const getPublicSlots = async (req, res) => {
  const { slug } = req.params;
  const { date, appointmentTypeId } = req.query;

  if (!date) {
    return badRequest(res, 'Date is required');
  }

  const provider = await Provider.findOne({ 
    bookingSlug: slug.toLowerCase(),
    isActive: true,
    publicBookingEnabled: true
  });

  if (!provider) {
    return notFound(res, 'Booking page not found');
  }

  // Use existing slot service to get available slots
  const slots = await slotService.getAvailableSlots(
    provider._id,
    new Date(date),
    appointmentTypeId
  );

  return ok(res, 'Slots retrieved successfully', {
    slots,
    timezone: provider.timezone
  });
};

// Get availability summary for a date range (public)
const getPublicAvailabilityRange = async (req, res) => {
  const { slug } = req.params;
  const { startDate, endDate, appointmentTypeId } = req.query;

  if (!startDate || !endDate) {
    return badRequest(res, 'Start date and end date are required (format: YYYY-MM-DD)');
  }

  const provider = await Provider.findOne({ 
    bookingSlug: slug.toLowerCase(),
    isActive: true,
    publicBookingEnabled: true
  });

  if (!provider) {
    return notFound(res, 'Booking page not found');
  }

  try {
    const availability = await slotService.getAvailabilityRange(
      provider._id,
      startDate,
      endDate,
      appointmentTypeId || null
    );

    // Create a map for easy lookup
    const availabilityMap = {};
    let datesWithAvailability = 0;
    
    availability.forEach(day => {
      availabilityMap[day.date] = {
        hasAvailability: day.hasAvailability,
        availableSlots: day.availableSlots
      };
      if (day.hasAvailability) datesWithAvailability++;
    });

    return ok(res, 'Availability range retrieved successfully', {
      period: { startDate, endDate },
      totalDays: availability.length,
      datesWithAvailability,
      availability: availabilityMap
    });
  } catch (error) {
    console.error('❌ Error getting public availability range:', error.message);
    return badRequest(res, error.message);
  }
};

// Create a guest booking (no login required)
const createGuestBooking = async (req, res) => {
  const { slug } = req.params;
  const {
    appointmentTypeId,
    startTime,
    guestName,
    guestEmail,
    guestPhone,
    answers,
    customerNotes,
    resourceId // For resource-based services
  } = req.body;

  console.log('🎫 [Guest Booking] Request received:', { 
    slug, 
    appointmentTypeId, 
    startTime, 
    guestName, 
    guestEmail,
    resourceId,
    body: req.body 
  });

  // Validate required guest info
  if (!guestName || !guestEmail) {
    return badRequest(res, 'Guest name and email are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(guestEmail)) {
    return badRequest(res, 'Invalid email format');
  }

  // Find provider by slug
  const provider = await Provider.findOne({ 
    bookingSlug: slug.toLowerCase(),
    isActive: true,
    publicBookingEnabled: true
  });

  console.log('🔍 [Guest Booking] Provider lookup:', { 
    slug: slug.toLowerCase(), 
    found: !!provider,
    providerId: provider?._id
  });

  if (!provider) {
    // Debug: Check if provider exists without conditions
    const providerDebug = await Provider.findOne({ bookingSlug: slug.toLowerCase() });
    console.log('🔍 [Guest Booking] Debug provider:', {
      exists: !!providerDebug,
      isActive: providerDebug?.isActive,
      publicBookingEnabled: providerDebug?.publicBookingEnabled
    });
    return notFound(res, 'Booking page not found or is not available');
  }

  const startTimeDate = new Date(startTime);

  // Validate start time is in the future
  if (isPast(startTimeDate)) {
    return badRequest(res, 'Cannot book appointments in the past');
  }

  // Get appointment type
  const appointmentType = await AppointmentType.findById(appointmentTypeId);

  if (!appointmentType) {
    return notFound(res, 'Appointment type not found');
  }

  if (!appointmentType.published) {
    return badRequest(res, 'This service is not available for booking');
  }

  // Verify appointment type belongs to this provider
  if (appointmentType.providerId.toString() !== provider._id.toString()) {
    return badRequest(res, 'Invalid appointment type for this provider');
  }

  // Calculate end time
  const endTime = addMinutes(startTimeDate, appointmentType.durationMinutes);

  // 🔒 ACQUIRE REDIS LOCK
  console.log(`🔒 [Guest] Attempting to acquire lock for slot: ${provider._id} at ${startTime}`);
  const lockAcquired = await redisLockService.acquireLock(provider._id, startTime);

  if (!lockAcquired) {
    console.log(`❌ [Guest] Lock acquisition failed - slot already being booked`);
    return conflict(res, 'This slot is currently being booked by another user. Please try again or select another slot');
  }

  try {
    console.log(`✅ [Guest] Lock acquired successfully`);

    // Validate resource selection for resource-based services
    let selectedResource = null;
    if (appointmentType.hasResources && appointmentType.resources?.length > 0) {
      if (!resourceId) {
        await redisLockService.releaseLock(provider._id, startTime);
        return badRequest(res, 'Please select a resource for this service');
      }
      
      // Find the resource
      const resource = appointmentType.resources.find(r => r._id.toString() === resourceId);
      if (!resource || !resource.isActive) {
        await redisLockService.releaseLock(provider._id, startTime);
        return badRequest(res, 'Invalid resource selected');
      }
      
      selectedResource = {
        resourceId: resource._id,
        name: resource.name
      };
    }

    // Double-check slot availability (even with lock)
    const isAvailable = await slotService.isSlotAvailable(
      provider._id,
      startTimeDate,
      appointmentTypeId,
      resourceId || null
    );

    if (!isAvailable) {
      console.log(`❌ [Guest] Slot no longer available`);
      await redisLockService.releaseLock(provider._id, startTime);
      return conflict(res, 'This slot is no longer available');
    }

    // Check max slots per day limit
    if (appointmentType.maxSlotsPerDay) {
      const startOfDay = getStartOfDay(startTimeDate);
      const endOfDay = getEndOfDay(startTimeDate);
      
      const todayBookingsCount = await Booking.countDocuments({
        appointmentTypeId,
        startTime: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['CANCELLED'] }
      });
      
      if (todayBookingsCount >= appointmentType.maxSlotsPerDay) {
        console.log(`❌ [Guest] Max slots per day reached`);
        await redisLockService.releaseLock(provider._id, startTime);
        return conflict(res, `Maximum bookings for this service on this day has been reached`);
      }
    }

    // Validate answers if questions are required
    if (appointmentType.questions && appointmentType.questions.length > 0) {
      const requiredQuestions = appointmentType.questions.filter(q => q.required);
      const answeredQuestions = answers ? answers.map(a => a.question) : [];

      for (const question of requiredQuestions) {
        if (!answeredQuestions.includes(question.question)) {
          await redisLockService.releaseLock(provider._id, startTime);
          return badRequest(res, `Required question not answered: ${question.question}`);
        }
      }
    }

    // Create guest booking
    const booking = await Booking.create({
      appointmentTypeId,
      providerId: provider._id,
      customerId: null, // No user account
      isGuestBooking: true,
      guestInfo: {
        name: guestName,
        email: guestEmail,
        phone: guestPhone || ''
      },
      selectedResource: selectedResource || undefined,
      startTime: startTimeDate,
      endTime,
      status: appointmentType.requiresApproval ? 'PENDING' : 'CONFIRMED',
      paymentStatus: appointmentType.price > 0 ? 'PENDING' : 'PAID',
      answers: answers || [],
      customerNotes: customerNotes || ''
    });

    // Release lock
    await redisLockService.releaseLock(provider._id, startTime);
    console.log(`✅ [Guest] Booking created and lock released`);

    // Populate for response
    await booking.populate([
      { path: 'appointmentTypeId', select: 'title durationMinutes price currency' },
      { path: 'providerId', select: 'name contactEmail timezone' }
    ]);

    // 📧 Send confirmation email with calendar invite (async - don't block response)
    (async () => {
      try {
        // Generate calendar invite
        const calendarContent = await calendarService.generateCalendarInvite(booking);
        
        // Send confirmation email to guest
        await emailService.sendBookingConfirmationEmail(booking, calendarContent);
        
        // Send notification to provider
        await emailService.sendProviderBookingNotification(booking);
        
        console.log(`📧 [Guest] Booking confirmation emails sent`);
      } catch (emailError) {
        console.error(`❌ [Guest] Failed to send confirmation emails:`, emailError);
      }
    })();

    return created(res, 'Booking created successfully', {
      booking: {
        _id: booking._id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        guestInfo: booking.guestInfo,
        appointmentType: booking.appointmentTypeId,
        provider: booking.providerId
      },
      // Return payment URL if payment is required
      requiresPayment: appointmentType.price > 0,
      paymentAmount: appointmentType.price,
      paymentCurrency: appointmentType.currency
    });

  } catch (error) {
    // Release lock on any error
    await redisLockService.releaseLock(provider._id, startTime);
    console.error(`❌ [Guest] Error creating booking:`, error);
    throw error;
  }
};

// Check if a slug is available
const checkSlugAvailability = async (req, res) => {
  const { slug } = req.params;

  if (!slug || slug.length < 3) {
    return badRequest(res, 'Slug must be at least 3 characters');
  }

  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug.toLowerCase())) {
    return badRequest(res, 'Slug can only contain lowercase letters, numbers, and hyphens');
  }

  const existing = await Provider.findOne({ bookingSlug: slug.toLowerCase() });

  return ok(res, 'Slug availability checked', {
    available: !existing,
    slug: slug.toLowerCase()
  });
};

// ========== PRIVATE BOOKING ENDPOINTS ==========

// Get private service by access token
const getPrivateService = async (req, res) => {
  const { token } = req.params;

  const appointmentType = await AppointmentType.findOne({
    privateAccessToken: token,
    isPrivate: true
  }).populate('providerId');

  if (!appointmentType) {
    return notFound(res, 'Private booking page not found or link has expired');
  }

  const provider = appointmentType.providerId;
  if (!provider || !provider.isActive) {
    return notFound(res, 'This service is currently unavailable');
  }

  return ok(res, 'Private service retrieved successfully', {
    service: {
      _id: appointmentType._id,
      title: appointmentType.title,
      description: appointmentType.description,
      durationMinutes: appointmentType.durationMinutes,
      price: appointmentType.price,
      currency: appointmentType.currency,
      images: appointmentType.images,
      questions: appointmentType.questions,
      location: appointmentType.location,
      hasResources: appointmentType.hasResources,
      resources: appointmentType.resources
    },
    provider: {
      _id: provider._id,
      name: provider.name,
      description: provider.description,
      avatar: provider.avatar,
      timezone: provider.timezone
    }
  });
};

// Get available slots for private service
const getPrivateServiceSlots = async (req, res) => {
  const { token } = req.params;
  const { date } = req.query;

  if (!date) {
    return badRequest(res, 'Date is required');
  }

  const appointmentType = await AppointmentType.findOne({
    privateAccessToken: token,
    isPrivate: true
  }).populate('providerId');

  if (!appointmentType) {
    return notFound(res, 'Private booking page not found');
  }

  const provider = appointmentType.providerId;
  if (!provider || !provider.isActive) {
    return notFound(res, 'This service is currently unavailable');
  }

  // Use existing slot service to get available slots
  const slots = await slotService.getAvailableSlots(
    provider._id,
    new Date(date),
    appointmentType._id
  );

  return ok(res, 'Slots retrieved successfully', {
    slots,
    timezone: provider.timezone
  });
};

// Get availability range for private service
const getPrivateServiceAvailabilityRange = async (req, res) => {
  const { token } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return badRequest(res, 'Start date and end date are required');
  }

  const appointmentType = await AppointmentType.findOne({
    privateAccessToken: token,
    isPrivate: true
  }).populate('providerId');

  if (!appointmentType) {
    return notFound(res, 'Private booking page not found');
  }

  const provider = appointmentType.providerId;
  if (!provider || !provider.isActive) {
    return notFound(res, 'This service is currently unavailable');
  }

  // Get availability for each day in range
  const start = getStartOfDay(new Date(startDate));
  const end = getEndOfDay(new Date(endDate));
  const availability = {};

  let currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const slots = await slotService.getAvailableSlots(
      provider._id,
      new Date(currentDate),
      appointmentType._id
    );
    availability[dateStr] = {
      available: slots.length > 0,
      slotCount: slots.length
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return ok(res, 'Availability retrieved successfully', {
    availability,
    timezone: provider.timezone
  });
};

// Create booking for private service
const createPrivateServiceBooking = async (req, res) => {
  const { token } = req.params;
  const { startTime, guestName, guestEmail, guestPhone, notes, questionAnswers, resourceId } = req.body;

  // Validate required fields
  if (!startTime || !guestName || !guestEmail) {
    return badRequest(res, 'Start time, name, and email are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(guestEmail)) {
    return badRequest(res, 'Please provide a valid email address');
  }

  const appointmentType = await AppointmentType.findOne({
    privateAccessToken: token,
    isPrivate: true
  }).populate('providerId');

  if (!appointmentType) {
    return notFound(res, 'Private booking page not found');
  }

  const provider = appointmentType.providerId;
  if (!provider || !provider.isActive) {
    return notFound(res, 'This service is currently unavailable');
  }

  const bookingStartTime = new Date(startTime);

  // Check if slot is in the past
  if (isPast(bookingStartTime)) {
    return badRequest(res, 'Cannot book a slot in the past');
  }

  // Try to acquire lock for this slot
  const lockAcquired = await redisLockService.acquireLock(provider._id, bookingStartTime);
  if (!lockAcquired) {
    return conflict(res, 'This slot is currently being booked. Please try again.');
  }

  try {
    // Calculate end time
    const endTime = addMinutes(bookingStartTime, appointmentType.durationMinutes);

    // Validate resource selection for resource-based services
    let selectedResource = null;
    if (appointmentType.hasResources && appointmentType.resources?.length > 0) {
      if (!resourceId) {
        await redisLockService.releaseLock(provider._id, bookingStartTime);
        return badRequest(res, 'Please select a resource for this service');
      }
      
      // Find the resource
      const resource = appointmentType.resources.find(r => r._id.toString() === resourceId);
      if (!resource || !resource.isActive) {
        await redisLockService.releaseLock(provider._id, bookingStartTime);
        return badRequest(res, 'Invalid resource selected');
      }
      
      selectedResource = {
        resourceId: resource._id,
        name: resource.name
      };
    }

    // Check slot availability
    const isAvailable = await slotService.checkSlotAvailability(
      provider._id,
      bookingStartTime,
      appointmentType._id,
      resourceId || null
    );

    if (!isAvailable) {
      await redisLockService.releaseLock(provider._id, bookingStartTime);
      return conflict(res, 'This slot is no longer available. Please select another time.');
    }

    // Calculate total amount
    const totalAmount = appointmentType.price;

    // Create booking
    const booking = await Booking.create({
      providerId: provider._id,
      appointmentTypeId: appointmentType._id,
      customerId: null,
      isGuestBooking: true,
      isPrivateBooking: true,
      guestInfo: {
        name: guestName,
        email: guestEmail,
        phone: guestPhone || ''
      },
      selectedResource: selectedResource || undefined,
      startTime: bookingStartTime,
      endTime,
      status: appointmentType.price > 0 ? 'PENDING' : 'CONFIRMED',
      paymentStatus: appointmentType.price > 0 ? 'PENDING' : 'PAID',
      answers: questionAnswers || [],
      customerNotes: notes || ''
    });

    // Release lock after successful booking
    await redisLockService.releaseLock(provider._id, bookingStartTime);

    // Populate for email
    await booking.populate([
      { path: 'appointmentTypeId', select: 'title durationMinutes price currency' },
      { path: 'providerId', select: 'name contactEmail timezone' }
    ]);

    // 📧 Send confirmation email with calendar invite (async - don't block response)
    (async () => {
      try {
        // Generate calendar invite
        const calendarContent = await calendarService.generateCalendarInvite(booking);
        
        // Send confirmation email to guest
        await emailService.sendBookingConfirmationEmail(booking, calendarContent);
        
        // Send notification to provider
        await emailService.sendProviderBookingNotification(booking);
        
        console.log(`📧 [Private Booking] Confirmation emails sent for: ${booking._id}`);
      } catch (emailError) {
        console.error('Failed to send booking confirmation email:', emailError);
      }
    })();

    return created(res, 'Booking created successfully', {
      booking: {
        _id: booking._id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        service: appointmentType.title,
        provider: provider.name
      },
      requiresPayment: appointmentType.price > 0,
      paymentAmount: appointmentType.price,
      paymentCurrency: appointmentType.currency
    });

  } catch (error) {
    await redisLockService.releaseLock(provider._id, bookingStartTime);
    console.error(`❌ [Private] Error creating booking:`, error);
    throw error;
  }
};

module.exports = {
  getProviderBySlug,
  getPublicAppointmentTypes,
  getPublicSlots,
  getPublicAvailabilityRange,
  createGuestBooking,
  checkSlugAvailability,
  // Private booking endpoints
  getPrivateService,
  getPrivateServiceSlots,
  getPrivateServiceAvailabilityRange,
  createPrivateServiceBooking
};
