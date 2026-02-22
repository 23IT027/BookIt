const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slot.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// Public routes (with optional authentication for personalization)
router.get('/:providerId', optionalAuth, validate(schemas.dateQuery), slotController.getAvailableSlots);
router.get('/:providerId/check', optionalAuth, slotController.checkSlotAvailability);
router.get('/:providerId/schedule', optionalAuth, slotController.getProviderSchedule);
router.get('/:providerId/availability-range', optionalAuth, slotController.getAvailabilityRange);

module.exports = router;
