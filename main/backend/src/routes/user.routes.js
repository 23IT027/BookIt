const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.post('/change-password', userController.changePassword);
router.post('/deactivate', userController.deactivateAccount);

module.exports = router;
