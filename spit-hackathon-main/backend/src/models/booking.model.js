const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  appointmentTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType',
    required: [true, 'Appointment type reference is required']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider reference is required']
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for guest bookings
  },
  // Guest booking info (for public booking without login)
  guestInfo: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true }
  },
  isGuestBooking: {
    type: Boolean,
    default: false
  },
  isPrivateBooking: {
    type: Boolean,
    default: false
  },
  // Resource selection (e.g., Ground 1, Court A)
  selectedResource: {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    name: {
      type: String,
      trim: true
    }
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required']
  },
  status: {
    type: String,
    enum: {
      values: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
      message: '{VALUE} is not a valid status'
    },
    default: 'PENDING'
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'PENDING'
  },
  answers: [{
    question: String,
    answer: mongoose.Schema.Types.Mixed
  }],
  customerNotes: {
    type: String,
    maxlength: [1000, 'Customer notes cannot exceed 1000 characters']
  },
  providerNotes: {
    type: String,
    maxlength: [1000, 'Provider notes cannot exceed 1000 characters']
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Refund info
  refundAmount: {
    type: Number,
    default: 0
  },
  refundStatus: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'FAILED', 'PARTIAL'],
    default: null
  },
  refundedAt: {
    type: Date
  },
  // Reschedule info
  rescheduledFrom: {
    type: Date
  },
  rescheduledAt: {
    type: Date
  },
  rescheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rescheduleReason: {
    type: String,
    maxlength: [500, 'Reschedule reason cannot exceed 500 characters']
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  attendees: [{
    name: String,
    email: String,
    phone: String
  }],
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ providerId: 1, status: 1 });
bookingSchema.index({ appointmentTypeId: 1 });
bookingSchema.index({ startTime: 1, endTime: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ providerId: 1, startTime: 1 }); // For slot availability checks

// Compound index for preventing double bookings
bookingSchema.index({ 
  providerId: 1, 
  startTime: 1, 
  status: 1 
}, {
  partialFilterExpression: {
    status: { $nin: ['CANCELLED'] }
  }
});

// Virtual for duration
bookingSchema.virtual('durationMinutes').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  return 0;
});

// Ensure startTime is before endTime
bookingSchema.pre('save', function(next) {
  if (this.endTime <= this.startTime) {
    return next(new Error('End time must be after start time'));
  }
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
