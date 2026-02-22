const cloudinary = require('cloudinary').v2;
const config = require('./env');

const initializeCloudinary = () => {
  if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
    console.warn('⚠️  Cloudinary not configured - image upload features will be disabled');
    return false;
  }

  try {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true
    });
    
    console.log('✅ Cloudinary initialized');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary initialization failed:', error.message);
    return false;
  }
};

module.exports = {
  initializeCloudinary,
  cloudinary
};
