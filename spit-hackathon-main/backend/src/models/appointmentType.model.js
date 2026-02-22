const mongoose = require('mongoose');
const crypto = require('crypto');

const appointmentTypeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  durationMinutes: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [5, 'Duration must be at least 5 minutes'],
    max: [480, 'Duration cannot exceed 480 minutes']
  },
  bufferMinutes: {
    type: Number,
    default: 0,
    min: [0, 'Buffer cannot be negative'],
    max: [120, 'Buffer cannot exceed 120 minutes']
  },
  // Private service fields
  isPrivate: {
    type: Boolean,
    default: false
  },
  privateAccessToken: {
    type: String,
    unique: true,
    sparse: true // Allow null/undefined values (only unique when set)
  },
  capacity: {
    type: Number,
    default: 1,
    min: [1, 'Capacity must be at least 1'],
    max: [100, 'Capacity cannot exceed 100']
  },
  maxSlotsPerDay: {
    type: Number,
    default: null, // null means unlimited
    min: [1, 'Max slots must be at least 1'],
    max: [50, 'Max slots cannot exceed 50']
  },
  // Per-service availability (overrides provider availability if set)
  availability: [{
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  useCustomAvailability: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  published: {
    type: Boolean,
    default: false
  },
  organiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organiser reference is required']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider reference is required']
  },
  images: [{
    url: String,
    publicId: String,
    description: String
  }],
  category: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  location: {
    type: {
      type: String,
      enum: ['ONLINE', 'IN_PERSON', 'HYBRID'],
      default: 'ONLINE'
    },
    address: String,
    meetingLink: String
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['TEXT', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX'],
      default: 'TEXT'
    },
    required: {
      type: Boolean,
      default: false
    },
    options: [String]
  }],
  requiresApproval: {
    type: Boolean,
    default: false
  },
  // Resources (e.g., Ground 1, Court A, Room 101)
  hasResources: {
    type: Boolean,
    default: false
  },
  resources: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  cancellationPolicy: {
    allowed: {
      type: Boolean,
      default: true
    },
    hoursBeforeStart: {
      type: Number,
      default: 24
    },
    refundPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Pre-save hook to generate private access token
appointmentTypeSchema.pre('save', function(next) {
  if (this.isPrivate && !this.privateAccessToken) {
    // Generate a unique 32-character token
    this.privateAccessToken = crypto.randomBytes(16).toString('hex');
  }
  // Clear token if service is made public
  if (!this.isPrivate && this.privateAccessToken) {
    this.privateAccessToken = undefined;
  }
  next();
});

// Indexes
appointmentTypeSchema.index({ organiserId: 1 });
appointmentTypeSchema.index({ providerId: 1 });
appointmentTypeSchema.index({ published: 1 });
appointmentTypeSchema.index({ category: 1 });
appointmentTypeSchema.index({ privateAccessToken: 1 });
appointmentTypeSchema.index({ title: 'text', description: 'text' });

const AppointmentType = mongoose.model('AppointmentType', appointmentTypeSchema);

module.exports = AppointmentType;
