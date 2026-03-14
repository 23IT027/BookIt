const User = require('../models/user.model');
const { ok, notFound, badRequest } = require('../helpers/response.helper');

/**
 * User Controller - handles user profile operations
 */

// Get user profile
const getProfile = async (req, res) => {
  return ok(res, 'Profile retrieved successfully', {
    user: req.user
  });
};

// Update user profile
const updateProfile = async (req, res) => {
  const { name, phone } = req.body;
  const userId = req.user._id;

  const updateData = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-passwordHash');

  if (!user) {
    return notFound(res, 'User not found');
  }

  return ok(res, 'Profile updated successfully', {
    user
  });
};

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  if (!currentPassword || !newPassword) {
    return badRequest(res, 'Current password and new password are required');
  }

  if (newPassword.length < 6) {
    return badRequest(res, 'New password must be at least 6 characters');
  }

  // Get user with password
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    return notFound(res, 'User not found');
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);

  if (!isPasswordValid) {
    return badRequest(res, 'Current password is incorrect');
  }

  // Update password
  user.passwordHash = newPassword;
  await user.save();

  return ok(res, 'Password changed successfully');
};

// Deactivate account
const deactivateAccount = async (req, res) => {
  const userId = req.user._id;

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false },
    { new: true }
  ).select('-passwordHash');

  return ok(res, 'Account deactivated successfully', {
    user
  });
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount
};
