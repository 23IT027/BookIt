const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availability.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isProvider } = require('../middlewares/role.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// Public route - get provider availability
router.get('/provider/:providerId', availabilityController.getProviderAvailability);

// Protected routes - Provider only (and admin)
router.post('/', authenticate, isProvider, validate(schemas.createAvailability), availabilityController.createAvailability);
router.get('/:id', authenticate, availabilityController.getAvailabilityById);
router.patch('/:id', authenticate, isProvider, availabilityController.updateAvailability);
router.delete('/:id', authenticate, isProvider, availabilityController.deleteAvailability);
router.post('/:id/exceptions', authenticate, isProvider, availabilityController.addException);
router.delete('/:id/exceptions/:exceptionId', authenticate, isProvider, availabilityController.removeException);

module.exports = router;
