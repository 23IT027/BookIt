const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// Public routes
router.post('/signup', validate(schemas.signup), authController.signup);
router.post('/login', validate(schemas.login), authController.login);

// OTP verification routes (public)
router.post('/send-otp', authController.sendVerificationOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/refresh', authenticate, authController.refreshToken);

module.exports = router;
