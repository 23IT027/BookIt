const AvailabilityRule = require('../models/availabilityRule.model');
const Booking = require('../models/booking.model');
const AppointmentType = require('../models/appointmentType.model');
const {
  getDayOfWeek,
  formatDate,
  combineDateAndTime,
  generateTimeSlots,
  getStartOfDay,
  getEndOfDay,
  addMinutes
} = require('../helpers/date.helper');

/**
 * Service for computing available slots dynamically
 */

class SlotService {
  /**
   * Get available slots for a provider on a specific date
   */
  async getAvailableSlots(providerId, date, appointmentTypeId = null) {
    const targetDate = new Date(date);
    const dayOfWeek = getDayOfWeek(targetDate);
    const dateString = formatDate(targetDate);

    console.log('📅 Slot Service - Looking for availability rules:');
    console.log('   Day of week:', dayOfWeek, '(0=Sunday, 1=Monday, etc.)');
    console.log('   Date string:', dateString);

    // Get appointment type details if specified
    let appointmentType = null;
    if (appointmentTypeId) {
      appointmentType = await AppointmentType.findById(appointmentTypeId);
      if (!appointmentType) {
        throw new Error('Appointment type not found');
      }
    }

    // Determine which availability to use
    let availabilityRules = [];
    
    // Check if appointment type has custom availability
    if (appointmentType && appointmentType.useCustomAvailability && appointmentType.availability?.length > 0) {
      console.log('📋 Using per-service custom availability');
      // Filter availability for this day
      availabilityRules = appointmentType.availability
        .filter(a => a.dayOfWeek === dayOfWeek && a.isActive !== false)
        .map(a => ({
          startTime: a.startTime,
          endTime: a.endTime,
          exceptions: [] // Custom availability doesn't have exceptions
        }));
    } else {
      // Use provider's default availability
      availabilityRules = await AvailabilityRule.find({
        providerId,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { $lte: targetDate },
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: targetDate } }
        ]
      });
    }

    console.log('📋 Found availability rules:', availabilityRules.length);
    
    if (availabilityRules.length === 0) {
      console.log('⚠️  NO AVAILABILITY RULES FOUND!');
      console.log('   Please create an availability rule for this provider.');
      console.log('   Make sure the dayOfWeek matches:', dayOfWeek);
      return [];
    }

    availabilityRules.forEach((rule, index) => {
      console.log(`   Rule ${index + 1}: ${rule.startTime} - ${rule.endTime}`);
    });

    // Get existing bookings for this date
    const startOfDay = getStartOfDay(targetDate);
    const endOfDay = getEndOfDay(targetDate);

    const bookingQuery = {
      providerId,
      startTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['CANCELLED'] }
    };
    
    // If checking for a specific appointment type, also filter by that type
    if (appointmentTypeId) {
      bookingQuery.appointmentTypeId = appointmentTypeId;
    }

    const existingBookings = await Booking.find(bookingQuery).select('startTime endTime appointmentTypeId selectedResource');

    // Check max slots per day limit
    if (appointmentType && appointmentType.maxSlotsPerDay) {
      const todayBookingsCount = await Booking.countDocuments({
        appointmentTypeId,
        startTime: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['CANCELLED'] }
      });
      
      if (todayBookingsCount >= appointmentType.maxSlotsPerDay) {
        console.log(`⚠️  Max slots per day reached (${todayBookingsCount}/${appointmentType.maxSlotsPerDay})`);
        return []; // No more slots available for this day
      }
    }

    // Generate slots from availability rules
    let allSlots = [];

    for (const rule of availabilityRules) {
      // Check if this date is in exceptions (only for provider rules)
      if (rule.exceptions) {
        const isException = rule.exceptions.some(
          ex => formatDate(ex.date) === dateString
        );
        if (isException) {
          continue;
        }
      }

      // Generate time slots for this rule
      const duration = appointmentType ? appointmentType.durationMinutes : 30;
      const buffer = appointmentType ? appointmentType.bufferMinutes : 0;

      const timeSlots = generateTimeSlots(
        rule.startTime,
        rule.endTime,
        duration,
        buffer
      );

      // Convert to full date-time slots
      const slots = timeSlots.map(slot => ({
        startTime: combineDateAndTime(dateString, slot.startTime),
        endTime: combineDateAndTime(dateString, slot.endTime),
        appointmentTypeId: appointmentTypeId || null,
        providerId
      }));

      allSlots = allSlots.concat(slots);
    }

    // Remove slots that overlap with existing bookings
    // If the service has resources, we need to check per-resource availability
    let availableSlots;
    
    if (appointmentType && appointmentType.hasResources && appointmentType.resources?.length > 0) {
      // For services with resources, a slot is available if at least one resource is free
      availableSlots = [];
      
      for (const slot of allSlots) {
        const slotResources = [];
        
        for (const resource of appointmentType.resources) {
          if (!resource.isActive) continue;
          
          // Check if this resource is booked for this slot
          const isResourceBooked = existingBookings.some(booking => {
            const overlaps = slot.startTime < booking.endTime && slot.endTime > booking.startTime;
            const sameResource = booking.selectedResource?.resourceId?.toString() === resource._id.toString();
            return overlaps && sameResource;
          });
          
          if (!isResourceBooked) {
            slotResources.push({
              resourceId: resource._id,
              name: resource.name
            });
          }
        }
        
        if (slotResources.length > 0) {
          availableSlots.push({
            ...slot,
            availableResources: slotResources
          });
        }
      }
    } else {
      // Regular slot filtering for services without resources
      availableSlots = allSlots.filter(slot => {
        return !this.isSlotBooked(slot, existingBookings, appointmentType);
      });
    }

    // Sort by start time
    availableSlots.sort((a, b) => a.startTime - b.startTime);

    // Remove past slots
    const now = new Date();
    const futureSlots = availableSlots.filter(slot => slot.startTime > now);

    // If max slots per day is set, limit the returned slots
    if (appointmentType && appointmentType.maxSlotsPerDay) {
      const todayBookingsCount = await Booking.countDocuments({
        appointmentTypeId,
        startTime: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['CANCELLED'] }
      });
      const remainingSlots = appointmentType.maxSlotsPerDay - todayBookingsCount;
      return futureSlots.slice(0, remainingSlots);
    }

    return futureSlots;
  }

  /**
   * Check if a slot overlaps with existing bookings
   */
  isSlotBooked(slot, bookings, appointmentType) {
    const capacity = appointmentType ? appointmentType.capacity : 1;

    // Count how many bookings overlap with this slot
    const overlappingBookings = bookings.filter(booking => {
      return (
        slot.startTime < booking.endTime &&
        slot.endTime > booking.startTime
      );
    });

    // Slot is booked if overlapping bookings >= capacity
    return overlappingBookings.length >= capacity;
  }

  /**
   * Check if a specific slot is available
   * @param {string} resourceId - Optional resource ID to check for resource-based services
   */
  async isSlotAvailable(providerId, startTime, appointmentTypeId, resourceId = null) {
    const appointmentType = await AppointmentType.findById(appointmentTypeId);
    
    if (!appointmentType) {
      throw new Error('Appointment type not found');
    }

    const endTime = addMinutes(startTime, appointmentType.durationMinutes);
    const capacity = appointmentType.capacity;

    // Check if provider has availability at this time
    const dayOfWeek = getDayOfWeek(startTime);
    
    // Check custom availability first if applicable
    let hasAvailability = false;
    
    if (appointmentType.useCustomAvailability && appointmentType.availability?.length > 0) {
      const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
      const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
      
      hasAvailability = appointmentType.availability.some(a => {
        return a.dayOfWeek === dayOfWeek && a.isActive !== false && 
               startTimeStr >= a.startTime && endTimeStr <= a.endTime;
      });
    } else {
      const availabilityRules = await AvailabilityRule.find({
        providerId,
        dayOfWeek,
        isActive: true,
        effectiveFrom: { $lte: startTime },
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: startTime } }
        ]
      });

      if (availabilityRules.length === 0) {
        return false;
      }

      // Check if time falls within any availability rule
      const startTimeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
      const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

      hasAvailability = availabilityRules.some(rule => {
        return startTimeStr >= rule.startTime && endTimeStr <= rule.endTime;
      });
    }

    if (!hasAvailability) {
      return false;
    }

    // For resource-based services, check if the specific resource is available
    if (appointmentType.hasResources && appointmentType.resources?.length > 0) {
      if (!resourceId) {
        // No resource specified - check if any resource is available
        for (const resource of appointmentType.resources) {
          if (!resource.isActive) continue;
          
          const resourceBooked = await Booking.countDocuments({
            appointmentTypeId,
            'selectedResource.resourceId': resource._id,
            status: { $nin: ['CANCELLED'] },
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          });
          
          if (resourceBooked === 0) {
            return true; // At least one resource is available
          }
        }
        return false;
      } else {
        // Check specific resource
        const resourceBooked = await Booking.countDocuments({
          appointmentTypeId,
          'selectedResource.resourceId': resourceId,
          status: { $nin: ['CANCELLED'] },
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        });
        
        return resourceBooked === 0;
      }
    }

    // Count existing bookings that overlap with this slot (for non-resource services)
    const overlappingBookings = await Booking.countDocuments({
      providerId,
      status: { $nin: ['CANCELLED'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    return overlappingBookings < capacity;
  }

  /**
   * Get provider's schedule for a date range
   */
  async getProviderSchedule(providerId, startDate, endDate) {
    const bookings = await Booking.find({
      providerId,
      startTime: { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $nin: ['CANCELLED'] }
    })
    .populate('customerId', 'name email')
    .populate('appointmentTypeId', 'title durationMinutes')
    .sort({ startTime: 1 });

    return bookings;
  }

  /**
   * Get availability summary for a date range
   * Returns which dates have available slots
   */
  async getAvailabilityRange(providerId, startDate, endDate, appointmentTypeId = null) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results = [];

    // Limit to max 60 days to prevent performance issues
    const maxDays = 60;
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const actualEnd = daysDiff > maxDays 
      ? new Date(start.getTime() + maxDays * 24 * 60 * 60 * 1000)
      : end;

    // Iterate through each date in the range
    let currentDate = new Date(start);
    while (currentDate <= actualEnd) {
      const dateString = formatDate(currentDate);
      
      try {
        const slots = await this.getAvailableSlots(providerId, dateString, appointmentTypeId);
        results.push({
          date: dateString,
          hasAvailability: slots.length > 0,
          availableSlots: slots
        });
      } catch (error) {
        // If there's an error, mark as no availability
        results.push({
          date: dateString,
          hasAvailability: false,
          availableSlots: []
        });
      }

      // Move to next day
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return results;
  }

  /**
   * Check if a specific slot is available for booking
   * @param {string} providerId - The provider ID
   * @param {Date} startTime - The start time to check
   * @param {string} appointmentTypeId - Optional appointment type ID
   * @param {string} resourceId - Optional resource ID for resource-based services
   * @returns {boolean} - Whether the slot is available
   */
  async checkSlotAvailability(providerId, startTime, appointmentTypeId = null, resourceId = null) {
    const slotDate = new Date(startTime);
    const dateString = formatDate(slotDate);
    
    // Get all available slots for this date
    const availableSlots = await this.getAvailableSlots(providerId, dateString, appointmentTypeId);
    
    // Check if the requested time matches any available slot
    const slotTimeStr = slotDate.toISOString();
    
    const isAvailable = availableSlots.some(slot => {
      const availableSlotTime = new Date(slot.startTime).toISOString();
      if (availableSlotTime !== slotTimeStr) return false;
      
      // If resourceId is specified, check if that specific resource is available
      if (resourceId && slot.availableResources) {
        return slot.availableResources.some(r => r.resourceId.toString() === resourceId);
      }
      
      return true;
    });
    
    return isAvailable;
  }
}

module.exports = new SlotService();
