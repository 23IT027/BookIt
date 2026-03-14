const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/role.middleware');

// All routes require admin authentication
router.use(authenticate);
router.use(isAdmin);

// Analytics
router.get('/analytics', adminController.getPlatformAnalytics);
router.get('/analytics/provider/:providerId', adminController.getProviderAnalytics);
router.get('/analytics/trends', adminController.getBookingTrends);

// Bookings (admin view)
router.get('/bookings', adminController.getAllBookings);

// User management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId', adminController.updateUser);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.patch('/users/:userId/role', adminController.updateUserRole);

// Appointment types / Services management
router.get('/services', adminController.getAllAppointmentTypes);
router.patch('/services/:id/publish', adminController.toggleAppointmentTypePublish);

// Reports
router.get('/reports', adminController.getSystemReports);

module.exports = router;
