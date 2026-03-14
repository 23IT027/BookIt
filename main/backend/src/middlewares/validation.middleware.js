const { z } = require('zod');
const { badRequest } = require('../helpers/response.helper');

/**
 * Validation middleware factory
 */
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return badRequest(res, 'Validation failed', errors);
      }
      next(error);
    }
  };
};

// Common validation schemas
const schemas = {
  // Auth
  signup: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required').max(100),
      email: z.string().email('Invalid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      role: z.enum(['CUSTOMER', 'PROVIDER']).optional(),
      phone: z.string().optional()
    })
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required')
    })
  }),

  forgotPassword: z.object({
    body: z.object({
      email: z.string().email('Invalid email address')
    })
  }),

  resetPassword: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      otp: z.string().min(4, 'OTP is required'),
      newPassword: z.string().min(6, 'Password must be at least 6 characters')
    })
  }),

  // Provider
  createProvider: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required').max(200),
      description: z.string().max(1000).optional(),
      specialization: z.string().optional(),
      timezone: z.string().default('UTC'),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      address: z.union([z.string(), z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional()
      })]).optional()
    })
  }),

  updateProvider: z.object({
    body: z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      specialization: z.string().optional(),
      timezone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      address: z.union([z.string(), z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional()
      })]).optional(),
      isActive: z.boolean().optional()
    })
  }),

  // Appointment Type
  createAppointmentType: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required').max(200),
      description: z.string().max(2000).optional(),
      durationMinutes: z.number().min(5).max(480),
      bufferMinutes: z.number().min(0).max(120).default(0),
      capacity: z.number().min(1).max(100).default(1),
      maxSlotsPerDay: z.number().min(1).max(50).nullable().optional(),
      price: z.number().min(0),
      currency: z.string().default('USD'),
      published: z.boolean().default(false),
      providerId: z.string().min(1, 'Provider ID is required'),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      pricingMode: z.enum(['PER_HOUR', 'PER_SLOT', 'FLAT']).optional(),
      useCustomAvailability: z.boolean().optional(),
      availability: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
        isActive: z.boolean().optional()
      })).optional()
    })
  }),

  // Availability Rule
  createAvailability: z.object({
    body: z.object({
      providerId: z.string().min(1, 'Provider ID is required'),
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
      effectiveFrom: z.string().or(z.date()),
      effectiveTo: z.string().or(z.date()).optional().nullable()
    })
  }),

  // Booking
  createBooking: z.object({
    body: z.object({
      appointmentTypeId: z.string().min(1, 'Appointment type ID is required'),
      providerId: z.string().min(1, 'Provider ID is required'),
      startTime: z.string().or(z.date()),
      answers: z.array(z.object({
        question: z.string(),
        answer: z.any()
      })).optional(),
      customerNotes: z.string().max(1000).optional()
    })
  }),

  // Query params
  dateQuery: z.object({
    query: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    })
  }),

  objectId: z.object({
    params: z.object({
      id: z.string().min(24).max(24)
    })
  })
};

module.exports = {
  validate,
  schemas
};
