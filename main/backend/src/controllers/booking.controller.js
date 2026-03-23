const Booking = require('../models/booking.model');
const AppointmentType = require('../models/appointmentType.model');
const Provider = require('../models/provider.model');
const Payment = require('../models/payment.model');
const OTP = require('../models/otp.model');
const slotService = require('../services/slot.service');
const redisLockService = require('../services/redisLock.service');
const emailService = require('../services/email.service');
const calendarService = require('../services/calendar.service');
const stripeService = require('../services/stripe.service');
const { created, ok, notFound, badRequest, conflict, forbidden } = require('../helpers/response.helper');
const { addMinutes, isPast, getHoursDifference, getStartOfDay, getEndOfDay } = require('../helpers/date.helper');

/**
 * Booking Controller - handles booking creation and management
 * Includes Redis locking to prevent double bookings
 */

// Create a new booking with Redis lock
const createBooking = async (req, res) => {
  const {
    appointmentTypeId,
    providerId,
    startTime,
    answers,
    customerNotes,
    resourceId
  } = req.body;

  const customerId = req.user._id;
  const startTimeDate = new Date(startTime);

  // Validate start time is in the future
  if (isPast(startTimeDate)) {
    return badRequest(res, 'Cannot book appointments in the past');
  }

  // Prevent providers/organisers from booking appointments
  if (req.user.role === 'PROVIDER' || req.user.role === 'ORGANISER') {
    return badRequest(res, 'Providers and Organisers cannot book appointments as customers');
  }

  // Get appointment type
  const appointmentType = await AppointmentType.findById(appointmentTypeId);

  if (!appointmentType) {
    return notFound(res, 'Appointment type not found');
  }

  if (!appointmentType.published) {
    return badRequest(res, 'This appointment type is not available for booking');
  }

  // Verify provider
  const provider = await Provider.findById(providerId);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  if (!provider.isActive) {
    return badRequest(res, 'This provider is not accepting bookings');
  }

  // Calculate end time
  const endTime = addMinutes(startTimeDate, appointmentType.durationMinutes);

  // 🔒 ACQUIRE REDIS LOCK
  console.log(`🔒 Attempting to acquire lock for slot: ${providerId} at ${startTime}`);
  const lockAcquired = await redisLockService.acquireLock(providerId, startTime);

  if (!lockAcquired) {
    console.log(`❌ Lock acquisition failed - slot already being booked`);
    return conflict(res, 'This slot is currently being booked by another user. Please try again or select another slot');
  }

  try {
    console.log(`✅ Lock acquired successfully`);

    // Double-check slot availability (even with lock)
    const isAvailable = await slotService.isSlotAvailable(
      providerId,
      startTimeDate,
      appointmentTypeId
    );

    if (!isAvailable) {
      console.log(`❌ Slot no longer available`);
      await redisLockService.releaseLock(providerId, startTime);
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
        console.log(`❌ Max slots per day reached (${todayBookingsCount}/${appointmentType.maxSlotsPerDay})`);
        await redisLockService.releaseLock(providerId, startTime);
        return conflict(res, `Maximum bookings for this service on this day has been reached (${appointmentType.maxSlotsPerDay} per day)`);
      }
    }

    // Validate answers if questions are required
    if (appointmentType.questions && appointmentType.questions.length > 0) {
      const requiredQuestions = appointmentType.questions.filter(q => q.required);
      const answeredQuestions = answers ? answers.map(a => a.question) : [];

      for (const question of requiredQuestions) {
        if (!answeredQuestions.includes(question.question)) {
          await redisLockService.releaseLock(providerId, startTime);
          return badRequest(res, `Required question not answered: ${question.question}`);
        }
      }
    }

    // Validate resource selection for services with resources
    let selectedResource = null;
    if (appointmentType.hasResources && appointmentType.resources?.length > 0) {
      if (!resourceId) {
        await redisLockService.releaseLock(providerId, startTime);
        return badRequest(res, 'Please select a resource for this service');
      }
      
      // Find the resource
      const resource = appointmentType.resources.find(r => 
        r._id.toString() === resourceId || r._id === resourceId
      );
      
      if (!resource) {
        await redisLockService.releaseLock(providerId, startTime);
        return badRequest(res, 'Invalid resource selected');
      }
      
      // Check if this specific resource is available
      const isResourceAvailable = await slotService.checkSlotAvailability(
        providerId,
        startTimeDate,
        appointmentTypeId,
        resourceId
      );
      
      if (!isResourceAvailable) {
        await redisLockService.releaseLock(providerId, startTime);
        return conflict(res, 'This resource is no longer available for the selected time');
      }
      
      selectedResource = {
        resourceId: resource._id,
        name: resource.name
      };
    }

    // Create booking
    const booking = await Booking.create({
      appointmentTypeId,
      providerId,
      customerId,
      startTime: startTimeDate,
      endTime,
      status: appointmentType.requiresApproval ? 'PENDING' : 'CONFIRMED',
      paymentStatus: appointmentType.price > 0 ? 'PENDING' : 'PAID',
      answers: answers || [],
      customerNotes,
      selectedResource
    });

    // Populate booking data
    await booking.populate([
      { path: 'appointmentTypeId', select: 'title durationMinutes price currency' },
      { path: 'providerId', select: 'name specialization contactEmail' },
      { path: 'customerId', select: 'name email phone' }
    ]);

    console.log(`✅ Booking created successfully: ${booking._id}`);

    // 🔓 RELEASE LOCK AFTER SUCCESSFUL BOOKING
    await redisLockService.releaseLock(providerId, startTime);
    console.log(`🔓 Lock released`);

    // 📧 Send confirmation email with calendar invite (async - don't block response)
    (async () => {
      try {
        // Generate calendar invite
        const calendarContent = await calendarService.generateCalendarInvite(booking);
        
        // Send confirmation email to customer
        await emailService.sendBookingConfirmationEmail(booking, calendarContent);
        
        // Send notification to provider
        await emailService.sendProviderBookingNotification(booking);
        
        console.log(`📧 Booking confirmation emails sent for: ${booking._id}`);
      } catch (emailError) {
        console.error(`❌ Failed to send confirmation emails:`, emailError);
      }
    })();

    // Emit WebSocket event (handled in websocket.js)
    if (global.io) {
      global.io.to(`provider:${providerId}`).emit('slotTaken', {
        providerId,
        startTime: startTimeDate,
        endTime,
        bookingId: booking._id
      });
      console.log(`📡 WebSocket event emitted: slotTaken`);
    }

    return created(res, 'Booking created successfully', {
      booking,
      requiresPayment: appointmentType.price > 0
    });

  } catch (error) {
    // 🔓 RELEASE LOCK ON ERROR
    await redisLockService.releaseLock(providerId, startTime);
    console.error(`❌ Booking creation failed:`, error);
    throw error;
  }
};

// Get customer's bookings
const getCustomerBookings = async (req, res) => {
  const customerId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { customerId };

  if (status) {
    query.status = status.toUpperCase();
  }

  const bookings = await Booking.find(query)
    .populate('appointmentTypeId', 'title durationMinutes price')
    .populate('providerId', 'name specialization contactEmail contactPhone bookingSlug')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ startTime: -1 });

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
};

// Get provider's bookings
const getProviderBookings = async (req, res) => {
  const { providerId } = req.params || req.query;
  const { status, startDate, endDate, page = 1, limit = 100 } = req.query;

  // Verify provider ownership
  const provider = await Provider.findById(providerId);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  if (req.user.role !== 'ADMIN' && provider.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only view bookings for your own provider');
  }

  const query = { providerId };

  if (status) {
    query.status = status.toUpperCase();
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
    .sort({ startTime: -1 }); // Sort by newest first

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
};

// Get booking by ID
const getBookingById = async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('appointmentTypeId')
    .populate('providerId')
    .populate('customerId', 'name email phone')
    .populate('cancelledBy', 'name');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  // Check access
  const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
  const isProvider = booking.providerId.userId && booking.providerId.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'ADMIN';

  if (!isCustomer && !isProvider && !isAdmin) {
    return forbidden(res, 'You do not have access to this booking');
  }

  return ok(res, 'Booking retrieved successfully', {
    booking
  });
};

// Request cancellation OTP
const requestCancellationOTP = async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate('appointmentTypeId')
    .populate('providerId')
    .populate('customerId', 'name email');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  if (booking.status === 'CANCELLED') {
    return badRequest(res, 'Booking is already cancelled');
  }

  if (booking.status === 'COMPLETED') {
    return badRequest(res, 'Cannot cancel a completed booking');
  }

  // Check access - only customer can request cancellation OTP
  const isCustomer = booking.customerId?._id?.toString() === req.user._id.toString();
  
  if (!isCustomer) {
    return forbidden(res, 'Only the customer can request cancellation');
  }

  // Get customer email
  const customerEmail = booking.isGuestBooking 
    ? booking.guestInfo?.email 
    : booking.customerId?.email;

  if (!customerEmail) {
    return badRequest(res, 'No email found for this booking');
  }

  // Generate OTP
  const otp = await OTP.createOTP(customerEmail, 'BOOKING_CANCELLATION');

  // Calculate refund amount (90% refund for customer cancellation)
  // First check if there's a successful payment, otherwise use appointment price
  const payment = await Payment.findOne({ bookingId: booking._id, status: 'SUCCEEDED' });
  const appointmentPrice = booking.appointmentTypeId?.price || 0;
  const paidAmount = payment ? payment.amount : appointmentPrice;
  const refundAmount = (paidAmount * 90) / 100;

  console.log(`💰 Refund calculation: paidAmount=${paidAmount}, refundAmount=${refundAmount}, paymentFound=${!!payment}`);

  // Send OTP email
  await emailService.sendCancellationOTPEmail(
    customerEmail, 
    otp, 
    booking.customerId?.name || booking.guestInfo?.name,
    booking.appointmentTypeId?.title,
    refundAmount
  );

  return ok(res, 'Cancellation OTP sent to your email', {
    email: customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    refundAmount,
    refundPercentage: 90,
    originalAmount: paidAmount
  });
};

// Cancel booking with OTP verification and 90% refund
const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const { reason, otp } = req.body;

  const booking = await Booking.findById(id)
    .populate('appointmentTypeId')
    .populate('providerId')
    .populate('customerId', 'name email');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  if (booking.status === 'CANCELLED') {
    return badRequest(res, 'Booking is already cancelled');
  }

  if (booking.status === 'COMPLETED') {
    return badRequest(res, 'Cannot cancel a completed booking');
  }

  // Check access
  const isCustomer = booking.customerId?._id?.toString() === req.user._id.toString();
  const isProvider = booking.providerId.userId && booking.providerId.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'ADMIN';

  if (!isCustomer && !isProvider && !isAdmin) {
    return forbidden(res, 'You do not have permission to cancel this booking');
  }

  // For customers, verify OTP first
  if (isCustomer) {
    if (!otp) {
      return badRequest(res, 'OTP is required for cancellation. Please request an OTP first.');
    }

    const customerEmail = booking.isGuestBooking 
      ? booking.guestInfo?.email 
      : booking.customerId?.email;

    const otpResult = await OTP.verifyOTP(customerEmail, otp, 'BOOKING_CANCELLATION');
    
    if (!otpResult.valid) {
      return badRequest(res, otpResult.message);
    }
  }

  // Set refund percentage: 90% for customers, 100% for provider/admin cancellations
  const refundPercentage = isCustomer ? 90 : 100;
  const appointmentPrice = booking.appointmentTypeId?.price || 0;

  // Process refund if payment was made
  let refundResult = null;
  let refundAmountINR = 0;
  let wasRefundProcessed = false;
  
  if (booking.paymentStatus === 'PAID') {
    try {
      const payment = await Payment.findOne({ bookingId: booking._id, status: 'SUCCEEDED' });
      
      if (payment && payment.stripePaymentIntentId) {
        refundAmountINR = (payment.amount * refundPercentage) / 100;
        refundResult = await stripeService.createRefund(
          payment._id, 
          refundAmountINR,
          `${refundPercentage}% refund - Cancelled by ${isCustomer ? 'customer' : isProvider ? 'provider' : 'admin'}${reason ? ': ' + reason : ''}`
        );
        wasRefundProcessed = true;
        console.log(`💰 Refund processed: ₹${refundAmountINR} (${refundPercentage}%)`);
      }
    } catch (refundError) {
      console.error('❌ Refund failed:', refundError);
      return badRequest(res, 'Failed to process refund. Please try again or contact support.');
    }
  } else {
    // For unpaid bookings, calculate what would have been refunded
    refundAmountINR = (appointmentPrice * refundPercentage) / 100;
  }

  // Cancel booking
  booking.status = 'CANCELLED';
  booking.cancellationReason = reason || 'Cancelled by user';
  booking.cancelledAt = new Date();
  booking.cancelledBy = req.user._id;
  if (wasRefundProcessed) {
    booking.paymentStatus = 'REFUNDED';
    booking.refundAmount = refundAmountINR;
    booking.refundStatus = 'PROCESSED';
    booking.refundedAt = new Date();
  }
  await booking.save();

  // Populate for email
  await booking.populate([
    { path: 'appointmentTypeId', select: 'title price' },
    { path: 'customerId', select: 'name email' }
  ]);

  // 📧 Send cancellation email (async - don't block response)
  (async () => {
    try {
      const cancelledByName = isCustomer ? 'Customer' : (isProvider ? booking.providerId.name : 'Administrator');
      await emailService.sendBookingCancellationEmail(booking, cancelledByName);
      console.log(`📧 Cancellation email sent for booking: ${booking._id}`);
    } catch (emailError) {
      console.error(`❌ Failed to send cancellation email:`, emailError);
    }
  })();

  // Emit WebSocket event
  if (global.io) {
    global.io.to(`provider:${booking.providerId._id}`).emit('bookingCancelled', {
      bookingId: booking._id,
      providerId: booking.providerId._id,
      startTime: booking.startTime
    });
  }

  return ok(res, 'Booking cancelled successfully', {
    booking,
    refund: {
      refunded: wasRefundProcessed,
      amount: refundAmountINR,
      percentage: refundPercentage,
      message: wasRefundProcessed 
        ? `₹${refundAmountINR.toFixed(2)} has been refunded to your original payment method`
        : (appointmentPrice > 0 ? 'No payment was made for this booking' : 'This was a free booking')
    }
  });
};

// Reschedule booking
const rescheduleBooking = async (req, res) => {
  const { id } = req.params;
  const { newStartTime, reason } = req.body;

  if (!newStartTime) {
    return badRequest(res, 'New start time is required');
  }

  const newStartDate = new Date(newStartTime);

  if (isPast(newStartDate)) {
    return badRequest(res, 'Cannot reschedule to a past date');
  }

  const booking = await Booking.findById(id)
    .populate('appointmentTypeId')
    .populate('providerId');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  if (booking.status === 'CANCELLED') {
    return badRequest(res, 'Cannot reschedule a cancelled booking');
  }

  if (booking.status === 'COMPLETED') {
    return badRequest(res, 'Cannot reschedule a completed booking');
  }

  // Check access
  const isCustomer = booking.customerId?.toString() === req.user._id.toString();
  const isProvider = booking.providerId.userId && booking.providerId.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'ADMIN';

  if (!isCustomer && !isProvider && !isAdmin) {
    return forbidden(res, 'You do not have permission to reschedule this booking');
  }

  // Check if new slot is available
  const isAvailable = await slotService.isSlotAvailable(
    booking.providerId._id,
    newStartDate,
    booking.appointmentTypeId._id
  );

  if (!isAvailable) {
    return conflict(res, 'The selected time slot is not available');
  }

  // Acquire lock for new slot
  const lockAcquired = await redisLockService.acquireLock(
    booking.providerId._id.toString(),
    newStartTime
  );

  if (!lockAcquired) {
    return conflict(res, 'This slot is currently being booked by another user');
  }

  try {
    // Store old time for reference
    const oldStartTime = booking.startTime;
    const oldEndTime = booking.endTime;

    // Calculate new end time
    const newEndTime = addMinutes(newStartDate, booking.appointmentTypeId.durationMinutes);

    // Update booking
    booking.startTime = newStartDate;
    booking.endTime = newEndTime;
    booking.rescheduledFrom = oldStartTime;
    booking.rescheduledAt = new Date();
    booking.rescheduledBy = req.user._id;
    booking.rescheduleReason = reason || 'Rescheduled by user';
    await booking.save();

    // Release lock
    await redisLockService.releaseLock(booking.providerId._id.toString(), newStartTime);

    // Populate for response and email
    await booking.populate([
      { path: 'appointmentTypeId', select: 'title durationMinutes price' },
      { path: 'providerId', select: 'name contactEmail' },
      { path: 'customerId', select: 'name email' }
    ]);

    // 📧 Send reschedule notification email (async)
    (async () => {
      try {
        await emailService.sendBookingRescheduleEmail(booking, oldStartTime);
        console.log(`📧 Reschedule email sent for booking: ${booking._id}`);
      } catch (emailError) {
        console.error(`❌ Failed to send reschedule email:`, emailError);
      }
    })();

    // Emit WebSocket event
    if (global.io) {
      // Release old slot
      global.io.to(`provider:${booking.providerId._id}`).emit('bookingCancelled', {
        bookingId: booking._id,
        providerId: booking.providerId._id,
        startTime: oldStartTime
      });
      // Take new slot
      global.io.to(`provider:${booking.providerId._id}`).emit('slotTaken', {
        providerId: booking.providerId._id,
        startTime: newStartDate,
        endTime: newEndTime,
        bookingId: booking._id
      });
    }

    return ok(res, 'Booking rescheduled successfully', {
      booking,
      previousTime: oldStartTime,
      newTime: newStartDate
    });

  } catch (error) {
    await redisLockService.releaseLock(booking.providerId._id.toString(), newStartTime);
    throw error;
  }
};

// Update booking status (provider/admin only)
const updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status, providerNotes } = req.body;

  if (!status) {
    return badRequest(res, 'Status is required');
  }

  const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
  if (!validStatuses.includes(status)) {
    return badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const booking = await Booking.findById(id)
    .populate('providerId')
    .populate('appointmentTypeId')
    .populate('customerId', 'name email');

  if (!booking) {
    return notFound(res, 'Booking not found');
  }

  // Check access (only provider or admin)
  const isProvider = booking.providerId.userId && booking.providerId.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'ADMIN';

  if (!isProvider && !isAdmin) {
    return forbidden(res, 'Only the provider or admin can update booking status');
  }

  const previousStatus = booking.status;
  booking.status = status;
  if (providerNotes) {
    booking.providerNotes = providerNotes;
  }

  await booking.save();

  // 📧 Send status update emails (async - don't block response)
  (async () => {
    try {
      if (status === 'CONFIRMED' && previousStatus !== 'CONFIRMED') {
        // Send confirmation email with calendar invite when approved
        const calendarContent = await calendarService.generateCalendarInvite(booking);
        await emailService.sendBookingConfirmationEmail(booking, calendarContent);
        console.log(`📧 Confirmation email sent for booking: ${booking._id}`);
      } else if (status === 'CANCELLED' && previousStatus !== 'CANCELLED') {
        // Send cancellation email
        await emailService.sendBookingCancellationEmail(booking, booking.providerId.name);
        console.log(`📧 Cancellation email sent for booking: ${booking._id}`);
      }
    } catch (emailError) {
      console.error(`❌ Failed to send status update email:`, emailError);
    }
  })();

  return ok(res, 'Booking status updated successfully', {
    booking
  });
};

module.exports = {
  createBooking,
  getCustomerBookings,
  getProviderBookings,
  getBookingById,
  requestCancellationOTP,
  cancelBooking,
  rescheduleBooking,
  updateBookingStatus
};
