const express = require('express');
const router = express.Router();
const providerController = require('../controllers/provider.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { isOrganiser } = require('../middlewares/role.middleware');
const { validate, schemas } = require('../middlewares/validation.middleware');

// Public routes
router.get('/', optionalAuth, providerController.getAllProviders);
router.get('/:id', optionalAuth, providerController.getProviderById);

// Protected routes
router.post('/', authenticate, isOrganiser, validate(schemas.createProvider), providerController.createProvider);
router.get('/user/:userId', authenticate, providerController.getProviderByUserId);
router.get('/user/me/provider', authenticate, isOrganiser, providerController.getProviderByUserId);

// Provider stats (must come before /:id routes)
router.get('/:id/stats', authenticate, providerController.getProviderStats);

// Update and delete (must come after specific routes)
router.patch('/:id', authenticate, validate(schemas.updateProvider), providerController.updateProvider);
router.delete('/:id', authenticate, providerController.deleteProvider);

// Handle empty ID error (helpful error message)
router.all('/', authenticate, (req, res) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `${req.method} request requires a provider ID. URL should be: /api/providers/{providerId}`,
      hint: 'Make sure to run "Create Provider" request first to save the provider ID',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
