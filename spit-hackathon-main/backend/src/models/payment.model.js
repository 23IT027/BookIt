const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is required'],
    unique: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for guest bookings
  },
  stripePaymentIntentId: {
    type: String,
    trim: true
  },
  stripeCheckoutSessionId: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    uppercase: true,
    default: 'INR'
  },
  status: {
    type: String,
    enum: {
      values: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'PENDING'
  },
  paymentMethod: {
    type: String,
    enum: ['STRIPE', 'MANUAL', 'FREE'],
    default: 'STRIPE'
  },
  receiptUrl: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refund amount cannot be negative']
  },
  refundReason: {
    type: String,
    maxlength: [500, 'Refund reason cannot exceed 500 characters']
  },
  refundedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes (bookingId index is automatic due to unique: true)
paymentSchema.index({ customerId: 1, status: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ stripeCheckoutSessionId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
