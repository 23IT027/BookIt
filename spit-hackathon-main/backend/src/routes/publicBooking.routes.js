const express = require('express');
const router = express.Router();
const publicBookingController = require('../controllers/publicBooking.controller');

/**
 * Public Booking Routes - No authentication required
 * These routes power the public booking page (like cal.com)
 */

// Check if a slug is available (must come before /:slug)
router.get('/check-slug/:slug', publicBookingController.checkSlugAvailability);

// ========== PRIVATE BOOKING ROUTES ==========
// Private service by access token (must come before /:slug to avoid conflicts)
router.get('/private/:token', publicBookingController.getPrivateService);
router.get('/private/:token/slots', publicBookingController.getPrivateServiceSlots);
router.get('/private/:token/availability-range', publicBookingController.getPrivateServiceAvailabilityRange);
router.post('/private/:token/book', publicBookingController.createPrivateServiceBooking);

// ========== PUBLIC BOOKING ROUTES ==========
// Get provider info by booking slug
router.get('/:slug', publicBookingController.getProviderBySlug);

// Get appointment types for a provider by slug
router.get('/:slug/services', publicBookingController.getPublicAppointmentTypes);

// Get available slots for a provider by slug
router.get('/:slug/slots', publicBookingController.getPublicSlots);

// Get availability summary for a date range
router.get('/:slug/availability-range', publicBookingController.getPublicAvailabilityRange);

// Create a guest booking
router.post('/:slug/book', publicBookingController.createGuestBooking);

module.exports = router;
