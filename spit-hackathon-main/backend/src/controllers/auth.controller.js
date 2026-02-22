const User = require('../models/user.model');
const OTP = require('../models/otp.model');
const { generateToken } = require('../middlewares/auth.middleware');
const { created, ok, badRequest, unauthorized } = require('../helpers/response.helper');
const { sendOTPEmail } = require('../services/email.service');

/**
 * Auth Controller - handles user authentication
 */

// Register new user
const signup = async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    return badRequest(res, 'Email already registered');
  }

  // Create user
  const user = await User.create({
    name,
    email,
    passwordHash: password, // Will be hashed by pre-save hook
    role: role || 'CUSTOMER',
    phone
  });

  // Generate token
  const token = generateToken(user._id, user.role);

  // Remove password from response
  const userResponse = user.toJSON();

  return created(res, 'User registered successfully', {
    user: userResponse,
    token
  });
};

// Login user
const login = async (req, res) => {
  const { email, password } = req.body;

  // Find user with password field
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    return unauthorized(res, 'Invalid email or password');
  }

  // Check if account is active
  if (!user.isActive) {
    return unauthorized(res, 'Account is inactive. Please contact support');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return unauthorized(res, 'Invalid email or password');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id, user.role);

  const userResponse = user.toJSON();

  return ok(res, 'Login successful', {
    user: userResponse,
    token
  });
};

// Get current user
const getCurrentUser = async (req, res) => {
  return ok(res, 'User retrieved successfully', {
    user: req.user
  });
};

// Refresh token
const refreshToken = async (req, res) => {
  // User is already authenticated via middleware
  const token = generateToken(req.user._id, req.user.role);

  return ok(res, 'Token refreshed successfully', {
    token
  });
};

// Send OTP for email verification
const sendVerificationOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return badRequest(res, 'Email is required');
  }

  // Check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    return badRequest(res, 'User not found with this email');
  }

  if (user.isEmailVerified) {
    return badRequest(res, 'Email is already verified');
  }

  // Generate and save OTP
  const otp = await OTP.createOTP(email, 'EMAIL_VERIFICATION');

  // Send OTP email
  const emailResult = await sendOTPEmail(email, otp, user.name);

  if (!emailResult.success) {
    return badRequest(res, 'Failed to send verification email. Please try again.');
  }

  return ok(res, 'Verification OTP sent to your email', {
    email,
    message: 'Please check your email for the OTP'
  });
};

// Verify OTP
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return badRequest(res, 'Email and OTP are required');
  }

  // Verify OTP
  const result = await OTP.verifyOTP(email, otp, 'EMAIL_VERIFICATION');

  if (!result.valid) {
    return badRequest(res, result.message);
  }

  // Update user's email verification status
  const user = await User.findOneAndUpdate(
    { email },
    { isEmailVerified: true },
    { new: true }
  );

  if (!user) {
    return badRequest(res, 'User not found');
  }

  // Generate new token with updated user info
  const token = generateToken(user._id, user.role);

  return ok(res, 'Email verified successfully', {
    user,
    token
  });
};

// Resend OTP
const resendOTP = async (req, res) => {
  const { email, purpose = 'EMAIL_VERIFICATION' } = req.body;

  if (!email) {
    return badRequest(res, 'Email is required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    return badRequest(res, 'User not found');
  }

  if (purpose === 'EMAIL_VERIFICATION' && user.isEmailVerified) {
    return badRequest(res, 'Email is already verified');
  }

  // Generate and save new OTP
  const otp = await OTP.createOTP(email, purpose);

  // Send OTP email
  const emailResult = await sendOTPEmail(email, otp, user.name);

  if (!emailResult.success) {
    return badRequest(res, 'Failed to send OTP. Please try again.');
  }

  return ok(res, 'OTP resent successfully', {
    email,
    message: 'Please check your email for the new OTP'
  });
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  refreshToken,
  sendVerificationOTP,
  verifyOTP,
  resendOTP
};
