const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availability.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isOrganiser } = require('../middlewares/role.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// Public route - get provider availability
router.get('/provider/:providerId', availabilityController.getProviderAvailability);

// Protected routes - Organiser only
router.post('/', authenticate, isOrganiser, validate(schemas.createAvailability), availabilityController.createAvailability);
router.get('/:id', authenticate, availabilityController.getAvailabilityById);
router.patch('/:id', authenticate, isOrganiser, availabilityController.updateAvailability);
router.delete('/:id', authenticate, isOrganiser, availabilityController.deleteAvailability);
router.post('/:id/exceptions', authenticate, isOrganiser, availabilityController.addException);
router.delete('/:id/exceptions/:exceptionId', authenticate, isOrganiser, availabilityController.removeException);

module.exports = router;
