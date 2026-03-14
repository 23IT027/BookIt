const ics = require('ics');
const { v4: uuidv4 } = require('uuid');

/**
 * Calendar Service - generates ICS calendar files for appointments
 */

/**
 * Generate ICS calendar event for a booking
 * @param {Object} booking - The booking document with populated fields
 * @returns {Promise<string>} - ICS file content as string
 */
const generateCalendarInvite = async (booking) => {
  try {
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);
    
    const appointmentTitle = booking.appointmentTypeId?.title || 'Appointment';
    const providerName = booking.providerId?.name || 'Provider';
    const providerEmail = booking.providerId?.contactEmail;
    
    const customerName = booking.isGuestBooking 
      ? booking.guestInfo?.name 
      : booking.customerId?.name;
    const customerEmail = booking.isGuestBooking 
      ? booking.guestInfo?.email 
      : booking.customerId?.email;

    // Build description
    let description = `Appointment: ${appointmentTitle}\\n`;
    description += `Provider: ${providerName}\\n`;
    description += `Customer: ${customerName}\\n`;
    
    if (booking.appointmentTypeId?.price > 0) {
      description += `Amount: ₹${booking.appointmentTypeId.price}\\n`;
    }
    
    if (booking.customerNotes) {
      description += `\\nNotes: ${booking.customerNotes}`;
    }

    // Build location
    let location = providerName;
    if (booking.providerId?.location?.address) {
      location = booking.providerId.location.address;
    }

    // Create event object
    const event = {
      start: [
        startTime.getFullYear(),
        startTime.getMonth() + 1,
        startTime.getDate(),
        startTime.getHours(),
        startTime.getMinutes()
      ],
      end: [
        endTime.getFullYear(),
        endTime.getMonth() + 1,
        endTime.getDate(),
        endTime.getHours(),
        endTime.getMinutes()
      ],
      title: `${appointmentTitle} with ${providerName}`,
      description: description,
      location: location,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      uid: `${booking._id}@appointmentbooking.com`,
      sequence: 0,
      productId: 'Appointment Booking System',
      organizer: providerEmail ? { 
        name: providerName, 
        email: providerEmail 
      } : undefined,
      attendees: [
        customerEmail ? {
          name: customerName,
          email: customerEmail,
          rsvp: true,
          partstat: 'ACCEPTED',
          role: 'REQ-PARTICIPANT'
        } : null,
        providerEmail ? {
          name: providerName,
          email: providerEmail,
          rsvp: true,
          partstat: 'ACCEPTED',
          role: 'REQ-PARTICIPANT'
        } : null
      ].filter(Boolean),
      alarms: [
        // Reminder 30 minutes before
        {
          action: 'display',
          description: `Reminder: ${appointmentTitle} with ${providerName}`,
          trigger: { minutes: 30, before: true }
        },
        // Reminder 1 hour before
        {
          action: 'display',
          description: `Reminder: ${appointmentTitle} with ${providerName} in 1 hour`,
          trigger: { hours: 1, before: true }
        }
      ]
    };

    // Generate ICS content
    return new Promise((resolve, reject) => {
      ics.createEvent(event, (error, value) => {
        if (error) {
          console.error('❌ Error generating calendar invite:', error);
          reject(error);
        } else {
          console.log('✅ Calendar invite generated successfully');
          resolve(value);
        }
      });
    });
  } catch (error) {
    console.error('❌ Error in generateCalendarInvite:', error);
    throw error;
  }
};

/**
 * Generate cancellation ICS (METHOD:CANCEL)
 */
const generateCancellationCalendar = async (booking) => {
  try {
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);
    
    const appointmentTitle = booking.appointmentTypeId?.title || 'Appointment';
    const providerName = booking.providerId?.name || 'Provider';

    const event = {
      start: [
        startTime.getFullYear(),
        startTime.getMonth() + 1,
        startTime.getDate(),
        startTime.getHours(),
        startTime.getMinutes()
      ],
      end: [
        endTime.getFullYear(),
        endTime.getMonth() + 1,
        endTime.getDate(),
        endTime.getHours(),
        endTime.getMinutes()
      ],
      title: `CANCELLED: ${appointmentTitle} with ${providerName}`,
      description: 'This appointment has been cancelled.',
      status: 'CANCELLED',
      uid: `${booking._id}@appointmentbooking.com`,
      sequence: 1,
      productId: 'Appointment Booking System',
      method: 'CANCEL'
    };

    return new Promise((resolve, reject) => {
      ics.createEvent(event, (error, value) => {
        if (error) {
          reject(error);
        } else {
          // Modify the ICS content to include METHOD:CANCEL
          const cancelledValue = value.replace(
            'BEGIN:VCALENDAR',
            'BEGIN:VCALENDAR\r\nMETHOD:CANCEL'
          );
          resolve(cancelledValue);
        }
      });
    });
  } catch (error) {
    console.error('❌ Error generating cancellation calendar:', error);
    throw error;
  }
};

module.exports = {
  generateCalendarInvite,
  generateCancellationCalendar
};
