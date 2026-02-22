const mongoose = require('mongoose');
const config = require('../config/env');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: [true, 'OTP is required']
  },
  purpose: {
    type: String,
    enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'LOGIN', 'BOOKING_CANCELLATION'],
    default: 'EMAIL_VERIFICATION'
  },
  verified: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + config.otp.expiresIn * 60 * 1000)
  }
}, {
  timestamps: true
});

// Index for auto-deletion of expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for faster lookup
otpSchema.index({ email: 1, purpose: 1 });

/**
 * Generate a random OTP
 */
otpSchema.statics.generateOTP = function() {
  const length = config.otp.length || 6;
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
};

/**
 * Create and save a new OTP
 */
otpSchema.statics.createOTP = async function(email, purpose = 'EMAIL_VERIFICATION') {
  // Delete any existing OTPs for this email and purpose
  await this.deleteMany({ email, purpose });
  
  const otp = this.generateOTP();
  const otpDoc = await this.create({
    email,
    otp,
    purpose,
    expiresAt: new Date(Date.now() + config.otp.expiresIn * 60 * 1000)
  });
  
  return otp;
};

/**
 * Verify an OTP
 */
otpSchema.statics.verifyOTP = async function(email, otp, purpose = 'EMAIL_VERIFICATION') {
  const otpDoc = await this.findOne({ 
    email, 
    purpose,
    expiresAt: { $gt: new Date() }
  });

  if (!otpDoc) {
    return { valid: false, message: 'OTP expired or not found' };
  }

  // Check attempts
  if (otpDoc.attempts >= 5) {
    await this.deleteOne({ _id: otpDoc._id });
    return { valid: false, message: 'Too many failed attempts. Please request a new OTP' };
  }

  if (otpDoc.otp !== otp) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    return { valid: false, message: `Invalid OTP. ${5 - otpDoc.attempts} attempts remaining` };
  }

  // OTP is valid - mark as verified and delete
  await this.deleteOne({ _id: otpDoc._id });
  return { valid: true, message: 'OTP verified successfully' };
};

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
