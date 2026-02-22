const AppointmentType = require('../models/appointmentType.model');
const Provider = require('../models/provider.model');
const multer = require('multer');
const path = require('path');
const cloudinaryService = require('../services/cloudinary.service');
const { created, ok, notFound, badRequest, forbidden } = require('../helpers/response.helper');

/**
 * Appointment Type Controller - handles appointment type CRUD
 */

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
}).array('images', 5);

// Create appointment type
const createAppointmentType = async (req, res) => {
  const {
    title,
    description,
    durationMinutes,
    bufferMinutes,
    capacity,
    maxSlotsPerDay,
    price,
    currency,
    published,
    providerId,
    category,
    tags,
    location,
    questions,
    requiresApproval,
    cancellationPolicy,
    useCustomAvailability,
    availability,
    isPrivate,
    hasResources,
    resources
  } = req.body;

  const organiserId = req.user._id;

  // Verify provider exists and belongs to organiser
  const provider = await Provider.findById(providerId);

  if (!provider) {
    return notFound(res, 'Provider not found');
  }

  if (req.user.role !== 'ADMIN' && provider.userId.toString() !== organiserId.toString()) {
    return forbidden(res, 'You can only create appointment types for your own providers');
  }

  // Create appointment type
  const appointmentType = await AppointmentType.create({
    title,
    description,
    durationMinutes,
    bufferMinutes: bufferMinutes || 0,
    capacity: capacity || 1,
    maxSlotsPerDay: maxSlotsPerDay || null,
    price,
    currency: currency || 'USD',
    published: published || false,
    organiserId,
    providerId,
    category,
    tags,
    location,
    questions,
    requiresApproval,
    cancellationPolicy,
    useCustomAvailability: useCustomAvailability || false,
    availability: availability || [],
    isPrivate: isPrivate || false,
    hasResources: hasResources === 'true' || hasResources === true,
    resources: resources || []
  });

  // If private, generate the booking link
  const responseData = { appointmentType };
  if (appointmentType.isPrivate && appointmentType.privateAccessToken) {
    responseData.privateBookingLink = `/private-booking/${appointmentType.privateAccessToken}`;
  }

  return created(res, 'Appointment type created successfully', responseData);
};

// Upload images for appointment type
const uploadImages = async (req, res) => {
  const { id } = req.params;

  const appointmentType = await AppointmentType.findById(id);

  if (!appointmentType) {
    return notFound(res, 'Appointment type not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && appointmentType.organiserId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only upload images for your own appointment types');
  }

  if (!req.files || req.files.length === 0) {
    return badRequest(res, 'No images provided');
  }

  try {
    // Upload to Cloudinary
    const uploadedImages = await cloudinaryService.uploadMultipleImages(
      req.files.map(file => file.path),
      'appointment-types'
    );

    // Add to appointment type
    const images = uploadedImages.map(img => ({
      url: img.url,
      publicId: img.publicId
    }));

    appointmentType.images.push(...images);
    await appointmentType.save();

    return ok(res, 'Images uploaded successfully', {
      images: appointmentType.images
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
};

// Create appointment type with images (multipart/form-data)
const createAppointmentTypeWithImages = async (req, res) => {
  try {
    // Debug: Log what we received
    console.log('📝 Received body:', req.body);
    console.log('📎 Received files:', req.files);
    
    // Parse form fields (all come as strings from multipart/form-data)
    const {
      title,
      description,
      durationMinutes,
      bufferMinutes,
      capacity,
      maxSlotsPerDay,
      price,
      currency,
      published,
      providerId,
      category,
      tags,
      location,
      questions,
      requiresApproval,
      cancellationPolicy,
      useCustomAvailability,
      availability,
      isPrivate,
      hasResources,
      resources
    } = req.body;

    // Validate required fields
    if (!title || !durationMinutes || !price || !providerId) {
      return badRequest(res, 'Missing required fields: title, durationMinutes, price, providerId');
    }

    // Validate providerId format (MongoDB ObjectId must be 24 hex characters)
    if (!providerId.match(/^[0-9a-fA-F]{24}$/)) {
      return badRequest(res, `Invalid providerId format. Expected 24 character hex string, got: ${providerId} (${providerId.length} characters)`);
    }

    const organiserId = req.user._id;

    // Verify provider exists and belongs to organiser
    const provider = await Provider.findById(providerId);

    if (!provider) {
      return notFound(res, 'Provider not found');
    }

    if (req.user.role !== 'ADMIN' && provider.userId.toString() !== organiserId.toString()) {
      return forbidden(res, 'You can only create appointment types for your own providers');
    }

    // Upload images to Cloudinary if provided
    let images = [];
    if (req.files && req.files.length > 0) {
      const uploadedImages = await cloudinaryService.uploadMultipleImages(
        req.files.map(file => file.path),
        'appointment-types'
      );
      images = uploadedImages.map(img => ({
        url: img.url,
        publicId: img.publicId
      }));
    }

    // Parse numeric and boolean values (they come as strings from form-data)
    const parsedData = {
      title,
      description,
      durationMinutes: parseInt(durationMinutes),
      bufferMinutes: bufferMinutes ? parseInt(bufferMinutes) : 0,
      capacity: capacity ? parseInt(capacity) : 1,
      maxSlotsPerDay: maxSlotsPerDay ? parseInt(maxSlotsPerDay) : null,
      price: parseFloat(price),
      currency: currency || 'USD',
      published: published === 'true' || published === true,
      organiserId,
      providerId,
      category,
      tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : undefined,
      location,
      questions: questions ? (typeof questions === 'string' ? JSON.parse(questions) : questions) : undefined,
      requiresApproval: requiresApproval === 'true' || requiresApproval === true,
      cancellationPolicy,
      useCustomAvailability: useCustomAvailability === 'true' || useCustomAvailability === true,
      availability: availability ? (typeof availability === 'string' ? JSON.parse(availability) : availability) : [],
      isPrivate: isPrivate === 'true' || isPrivate === true,
      hasResources: hasResources === 'true' || hasResources === true,
      resources: resources ? (typeof resources === 'string' ? JSON.parse(resources) : resources) : [],
      images
    };

    // Create appointment type
    const appointmentType = await AppointmentType.create(parsedData);

    return created(res, 'Appointment type created successfully with images', {
      appointmentType
    });
  } catch (error) {
    console.error('❌ Error creating appointment type with images:', error);
    return badRequest(res, error.message);
  }
};

// Get all appointment types
const getAllAppointmentTypes = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    providerId,
    published,
    minPrice,
    maxPrice
  } = req.query;

  const query = {};

  // For customers and unauthenticated users, only show published types
  if (!req.user || req.user.role === 'CUSTOMER') {
    query.published = true;
  } else if (published !== undefined) {
    query.published = published === 'true';
  }

  // Search filter
  if (search) {
    query.$text = { $search: search };
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Provider filter
  if (providerId) {
    query.providerId = providerId;
  }

  // Price filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Organiser can see only their types (unless admin)
  if (req.user && req.user.role === 'ORGANISER') {
    query.organiserId = req.user._id;
  }

  const appointmentTypes = await AppointmentType.find(query)
    .populate('providerId', 'name specialization')
    .populate('organiserId', 'name email')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await AppointmentType.countDocuments(query);

  return ok(res, 'Appointment types retrieved successfully', {
    appointmentTypes,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total,
      hasMore: page * limit < total
    }
  });
};

// Get appointment type by ID
const getAppointmentTypeById = async (req, res) => {
  const { id } = req.params;

  const appointmentType = await AppointmentType.findById(id)
    .populate('providerId', 'name specialization timezone contactEmail contactPhone')
    .populate('organiserId', 'name email');

  if (!appointmentType) {
    return notFound(res, 'Appointment type not found');
  }

  // Check if customer is trying to access unpublished type
  if (req.user && req.user.role === 'CUSTOMER' && !appointmentType.published) {
    return forbidden(res, 'This appointment type is not available');
  }

  return ok(res, 'Appointment type retrieved successfully', {
    appointmentType
  });
};

// Update appointment type
const updateAppointmentType = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const appointmentType = await AppointmentType.findById(id);

  if (!appointmentType) {
    return notFound(res, 'Appointment type not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && appointmentType.organiserId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only update your own appointment types');
  }

  // Update fields
  const allowedUpdates = [
    'title', 'description', 'durationMinutes', 'bufferMinutes',
    'capacity', 'maxSlotsPerDay', 'price', 'currency', 'published', 'category',
    'tags', 'location', 'questions', 'requiresApproval', 'cancellationPolicy',
    'useCustomAvailability', 'availability', 'isPrivate', 'hasResources', 'resources'
  ];

  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      appointmentType[field] = updates[field];
    }
  });

  await appointmentType.save();

  // If private, include the booking link in response
  const responseData = { appointmentType };
  if (appointmentType.isPrivate && appointmentType.privateAccessToken) {
    responseData.privateBookingLink = `/private-booking/${appointmentType.privateAccessToken}`;
  }

  return ok(res, 'Appointment type updated successfully', responseData);
};

// Delete appointment type
const deleteAppointmentType = async (req, res) => {
  const { id } = req.params;

  const appointmentType = await AppointmentType.findById(id);

  if (!appointmentType) {
    return notFound(res, 'Appointment type not found');
  }

  // Check ownership
  if (req.user.role !== 'ADMIN' && appointmentType.organiserId.toString() !== req.user._id.toString()) {
    return forbidden(res, 'You can only delete your own appointment types');
  }

  // Delete images from Cloudinary
  if (appointmentType.images.length > 0) {
    const publicIds = appointmentType.images.map(img => img.publicId).filter(Boolean);
    if (publicIds.length > 0) {
      await cloudinaryService.deleteMultipleImages(publicIds);
    }
  }

  await AppointmentType.findByIdAndDelete(id);

  return ok(res, 'Appointment type deleted successfully');
};

module.exports = {
  upload,
  createAppointmentType,
  uploadImages,
  createAppointmentTypeWithImages,
  getAllAppointmentTypes,
  getAppointmentTypeById,
  updateAppointmentType,
  deleteAppointmentType
};
