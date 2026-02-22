const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isOrganiser } = require('../middlewares/role.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// All routes require authentication
router.use(authenticate);

// Customer routes
router.post('/', validate(schemas.createBooking), bookingController.createBooking);
router.get('/customer', bookingController.getCustomerBookings);
router.get('/customer/:id', bookingController.getBookingById);
router.post('/:id/request-cancel-otp', bookingController.requestCancellationOTP);
router.patch('/:id/cancel', bookingController.cancelBooking);
router.patch('/:id/reschedule', bookingController.rescheduleBooking);

// Provider routes (Organiser/Admin only)
router.get('/provider', isOrganiser, bookingController.getProviderBookings);
router.get('/provider/:providerId', isOrganiser, bookingController.getProviderBookings);
router.patch('/:id/status', isOrganiser, bookingController.updateBookingStatus);

// General routes
router.get('/:id', bookingController.getBookingById);

module.exports = router;
