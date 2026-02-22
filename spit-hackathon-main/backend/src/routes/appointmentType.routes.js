const express = require('express');
const router = express.Router();
const appointmentTypeController = require('../controllers/appointmentType.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { isOrganiser } = require('../middlewares/role.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// Public routes
router.get('/', optionalAuth, appointmentTypeController.getAllAppointmentTypes);
router.get('/:id', optionalAuth, appointmentTypeController.getAppointmentTypeById);

// Protected routes - Organiser only
router.post(
  '/',
  authenticate,
  isOrganiser,
  validate(schemas.createAppointmentType),
  appointmentTypeController.createAppointmentType
);

// Alternative route: Create with file upload (multipart/form-data)
router.post(
  '/with-images',
  authenticate,
  isOrganiser,
  (req, res, next) => {
    appointmentTypeController.upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: err.message || 'File upload error'
        });
      }
      next();
    });
  },
  appointmentTypeController.createAppointmentTypeWithImages
);

router.post(
  '/:id/images',
  authenticate,
  isOrganiser,
  (req, res, next) => {
    appointmentTypeController.upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: err.message || 'File upload error'
        });
      }
      next();
    });
  },
  appointmentTypeController.uploadImages
);

router.patch('/:id', authenticate, isOrganiser, appointmentTypeController.updateAppointmentType);
router.delete('/:id', authenticate, isOrganiser, appointmentTypeController.deleteAppointmentType);

module.exports = router;
