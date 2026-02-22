const AvailabilityRule = require('../models/availabilityRule.model');
const Provider = require('../models/provider.model');
const { created, ok, notFound, badRequest, forbidden } = require('../helpers/response.helper');

/**
 * Availability Controller - handles availability rules
 */

// Create availability rule
const createAvailability = async (req, res) => {
  const {
    providerId,
    dayOfWeek,
    startTime,
    endTime,
    effectiveFrom,
    effectiveTo,
    recurrence
  } = req.body;

  // Verify provider exists
  const provider = await Provider.findById(providerId);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && provider.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only create availability for your own provider');
  }

  // Create availability rule
  const availabilityRule = await AvailabilityRule.create({
    providerId,
    dayOfWeek,
    startTime,
    endTime,
    effectiveFrom,
    effectiveTo,
    recurrence: recurrence || 'WEEKLY'
  });

  return created(res, 'Availability rule created successfully', {
    availabilityRule
  });
};

// Get availability for a provider
const getProviderAvailability = async (req, res) => {
  const { providerId } = req.params;
  const { includeInactive } = req.query;

  const query = { providerId };

  if (!includeInactive || includeInactive === 'false') {
    query.isActive = true;
  }

  const availabilityRules = await AvailabilityRule.find(query)
    .sort({ dayOfWeek: 1, startTime: 1 });

  return ok(res, 'Availability rules retrieved successfully', {
    availabilityRules
  });
};

// Get availability rule by ID
const getAvailabilityById = async (req, res) => {
  const { id } = req.params;

  const availabilityRule = await AvailabilityRule.findById(id)
    .populate('providerId', 'name specialization');

  if (!availabilityRule) {
    return notFound(res, 'Availability rule not found');
  }

  return ok(res, 'Availability rule retrieved successfully', {
    availabilityRule
  });
};

// Update availability rule
const updateAvailability = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const availabilityRule = await AvailabilityRule.findById(id).populate('providerId');

  if (!availabilityRule) {
    return notFound(res, 'Availability rule not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && availabilityRule.providerId.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only update availability for your own provider');
  }

  // Update fields
  const allowedUpdates = [
    'dayOfWeek', 'startTime', 'endTime', 'effectiveFrom',
    'effectiveTo', 'isActive', 'recurrence'
  ];

  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      availabilityRule[field] = updates[field];
    }
  });

  await availabilityRule.save();

  return ok(res, 'Availability rule updated successfully', {
    availabilityRule
  });
};

// Delete availability rule
const deleteAvailability = async (req, res) => {
  const { id } = req.params;

  const availabilityRule = await AvailabilityRule.findById(id).populate('providerId');

  if (!availabilityRule) {
    return notFound(res, 'Availability rule not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && availabilityRule.providerId.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only delete availability for your own provider');
  }

  await AvailabilityRule.findByIdAndDelete(id);

  return ok(res, 'Availability rule deleted successfully');
};

// Add exception to availability rule
const addException = async (req, res) => {
  const { id } = req.params;
  const { date, reason } = req.body;

  if (!date) {
    return badRequest(res, 'Exception date is required');
  }

  const availabilityRule = await AvailabilityRule.findById(id).populate('providerId');

  if (!availabilityRule) {
    return notFound(res, 'Availability rule not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && availabilityRule.providerId.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only add exceptions to your own provider availability');
  }

  // Add exception
  availabilityRule.exceptions.push({
    date: new Date(date),
    reason: reason || 'Not available'
  });

  await availabilityRule.save();

  return ok(res, 'Exception added successfully', {
    availabilityRule
  });
};

// Remove exception from availability rule
const removeException = async (req, res) => {
  const { id, exceptionId } = req.params;

  const availabilityRule = await AvailabilityRule.findById(id).populate('providerId');

  if (!availabilityRule) {
    return notFound(res, 'Availability rule not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && availabilityRule.providerId.userId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only remove exceptions from your own provider availability');
  }

  // Remove exception
  availabilityRule.exceptions = availabilityRule.exceptions.filter(
    ex => ex._id.toString() !== exceptionId
  );

  await availabilityRule.save();

  return ok(res, 'Exception removed successfully', {
    availabilityRule
  });
};

module.exports = {
  createAvailability,
  getProviderAvailability,
  getAvailabilityById,
  updateAvailability,
  deleteAvailability,
  addException,
  removeException
};
