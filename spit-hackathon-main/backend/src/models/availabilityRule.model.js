const mongoose = require('mongoose');

const availabilityRuleSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider reference is required']
  },
  dayOfWeek: {
    type: Number,
    required: [true, 'Day of week is required'],
    min: [0, 'Day of week must be 0 (Sunday) to 6 (Saturday)'],
    max: [6, 'Day of week must be 0 (Sunday) to 6 (Saturday)']
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format']
  },
  effectiveFrom: {
    type: Date,
    required: [true, 'Effective from date is required']
  },
  effectiveTo: {
    type: Date,
    default: null // null means no end date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  recurrence: {
    type: String,
    enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'],
    default: 'WEEKLY'
  },
  exceptions: [{
    date: Date,
    reason: String
  }]
}, {
  timestamps: true
});

// Indexes
availabilityRuleSchema.index({ providerId: 1, dayOfWeek: 1 });
availabilityRuleSchema.index({ providerId: 1, isActive: 1 });
availabilityRuleSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

// Validation: endTime must be after startTime
availabilityRuleSchema.pre('save', function(next) {
  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  if (endMinutes <= startMinutes) {
    return next(new Error('End time must be after start time'));
  }
  
  next();
});

const AvailabilityRule = mongoose.model('AvailabilityRule', availabilityRuleSchema);

module.exports = AvailabilityRule;
