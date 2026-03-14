require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/appointment-booking',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisLockTTL: parseInt(process.env.REDIS_LOCK_TTL) || 30000,
  
  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/booking/success',
    cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/booking/cancel'
  },
  
  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  
  // Email (Nodemailer)
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'Appointment Booking <noreply@appointmentbooking.com>'
  },
  
  // OTP Settings
  otp: {
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN) || 10, // minutes
    length: parseInt(process.env.OTP_LENGTH) || 6
  },
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,image/webp').split(',')
};

// Validate critical environment variables
const validateConfig = () => {
  const required = ['mongoUri', 'jwtSecret'];
  const missing = required.filter(key => !config[key] && !config[key.split('.')[0]]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
};

validateConfig();

module.exports = config;
