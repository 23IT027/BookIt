const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Provider name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  // Public booking slug (like cal.com/username)
  bookingSlug: {
    type: String,
    unique: true,
    sparse: true, // Allows null values, only enforces uniqueness for non-null
    trim: true,
    lowercase: true,
    maxlength: [50, 'Booking slug cannot exceed 50 characters'],
    match: [/^[a-z0-9-]+$/, 'Booking slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  specialization: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  timezone: {
    type: String,
    default: 'UTC',
    required: true
  },
  avatar: {
    type: String // Cloudinary URL
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  address: {
    type: mongoose.Schema.Types.Mixed, // Accept both string and object
    default: null
  },
  // Public booking settings
  publicBookingEnabled: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Add index for bookingSlug lookups
providerSchema.index({ bookingSlug: 1 });

// Indexes (userId unique index defined once below)
providerSchema.index({ isActive: 1 });
providerSchema.index({ name: 'text', specialization: 'text' });

// Ensure one provider per user
providerSchema.index({ userId: 1 }, { unique: true });

const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;
