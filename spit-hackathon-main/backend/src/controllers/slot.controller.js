const slotService = require('../services/slot.service');
const { ok, badRequest } = require('../helpers/response.helper');

/**
 * Slot Controller - handles slot availability queries
 */

// Get available slots for a provider on a specific date
const getAvailableSlots = async (req, res) => {
  const { providerId } = req.params;
  const { date, appointmentTypeId } = req.query;

  console.log('🔍 Generating slots for:');
  console.log('   Provider ID:', providerId);
  console.log('   Date:', date);
  console.log('   Appointment Type ID:', appointmentTypeId || 'Not specified');

  if (!date) {
    return badRequest(res, 'Date parameter is required (format: YYYY-MM-DD)');
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return badRequest(res, 'Invalid date format. Use YYYY-MM-DD');
  }

  try {
    const slots = await slotService.getAvailableSlots(
      providerId,
      date,
      appointmentTypeId || null
    );

    console.log('✅ Generated slots:', slots.length);

    return ok(res, 'Available slots retrieved successfully', {
      providerId,
      date,
      appointmentTypeId: appointmentTypeId || null,
      totalSlots: slots.length,
      slots
    });
  } catch (error) {
    console.error('❌ Error generating slots:', error.message);
    return badRequest(res, error.message);
  }
};

// Check if a specific slot is available
const checkSlotAvailability = async (req, res) => {
  const { providerId, appointmentTypeId } = req.params;
  const { startTime } = req.query;

  if (!startTime) {
    return badRequest(res, 'Start time parameter is required');
  }

  try {
    const isAvailable = await slotService.isSlotAvailable(
      providerId,
      new Date(startTime),
      appointmentTypeId
    );

    return ok(res, 'Slot availability checked', {
      providerId,
      appointmentTypeId,
      startTime,
      isAvailable
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Get provider schedule for a date range
const getProviderSchedule = async (req, res) => {
  const { providerId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return badRequest(res, 'Start date and end date are required');
  }

  try {
    const schedule = await slotService.getProviderSchedule(
      providerId,
      startDate,
      endDate
    );

    return ok(res, 'Provider schedule retrieved successfully', {
      providerId,
      period: { startDate, endDate },
      totalBookings: schedule.length,
      schedule
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Get availability summary for a date range
const getAvailabilityRange = async (req, res) => {
  const { providerId } = req.params;
  const { startDate, endDate, appointmentTypeId } = req.query;

  if (!startDate || !endDate) {
    return badRequest(res, 'Start date and end date are required (format: YYYY-MM-DD)');
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return badRequest(res, 'Invalid date format. Use YYYY-MM-DD');
  }

  try {
    const availability = await slotService.getAvailabilityRange(
      providerId,
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
      providerId,
      appointmentTypeId: appointmentTypeId || null,
      period: { startDate, endDate },
      totalDays: availability.length,
      datesWithAvailability,
      availability: availabilityMap
    });
  } catch (error) {
    console.error('❌ Error getting availability range:', error.message);
    return badRequest(res, error.message);
  }
};

module.exports = {
  getAvailableSlots,
  checkSlotAvailability,
  getProviderSchedule,
  getAvailabilityRange
};
