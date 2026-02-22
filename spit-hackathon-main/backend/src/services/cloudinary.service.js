const { cloudinary } = require('../config/cloudinary');
const fs = require('fs').promises;

/**
 * Cloudinary image upload service
 */

class CloudinaryService {
  /**
   * Upload a single image to Cloudinary
   */
  async uploadImage(filePath, folder = 'appointments') {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 800, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });

      // Clean up local file
      await this.deleteLocalFile(filePath);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      // Clean up local file even if upload fails
      await this.deleteLocalFile(filePath);
      console.error('Cloudinary upload failed:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple images to Cloudinary
   */
  async uploadMultipleImages(filePaths, folder = 'appointments') {
    try {
      const uploadPromises = filePaths.map(filePath => 
        this.uploadImage(filePath, folder)
      );
      
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Multiple image upload failed:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Cloudinary
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        console.log(`✅ Deleted image: ${publicId}`);
        return true;
      }
      
      console.warn(`⚠️  Failed to delete image: ${publicId}`);
      return false;
    } catch (error) {
      console.error('Cloudinary delete failed:', error);
      throw new Error(`Image deletion failed: ${error.message}`);
    }
  }

  /**
   * Delete multiple images from Cloudinary
   */
  async deleteMultipleImages(publicIds) {
    try {
      const deletePromises = publicIds.map(publicId => 
        this.deleteImage(publicId)
      );
      
      return await Promise.all(deletePromises);
    } catch (error) {
      console.error('Multiple image deletion failed:', error);
      throw error;
    }
  }

  /**
   * Delete local file
   */
  async deleteLocalFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore error if file doesn't exist
      if (error.code !== 'ENOENT') {
        console.error('Failed to delete local file:', error);
      }
    }
  }

  /**
   * Get image URL with transformations
   */
  getTransformedUrl(publicId, transformations = {}) {
    const {
      width,
      height,
      crop = 'fill',
      quality = 'auto',
      format = 'auto'
    } = transformations;

    return cloudinary.url(publicId, {
      width,
      height,
      crop,
      quality,
      fetch_format: format,
      secure: true
    });
  }

  /**
   * Get thumbnail URL
   */
  getThumbnailUrl(publicId, size = 200) {
    return this.getTransformedUrl(publicId, {
      width: size,
      height: size,
      crop: 'thumb'
    });
  }
}

module.exports = new CloudinaryService();
