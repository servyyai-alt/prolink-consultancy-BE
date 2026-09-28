const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary.
 * Accepts either:
 *  - a file path string (local disk / legacy)
 *  - a multer file object with .buffer (memoryStorage — required on Vercel)
 */
const uploadToCloudinary = async (fileOrPath, folder = 'prolink', options = {}) => {
  try {
    // Legacy: string path (local dev with diskStorage)
    if (typeof fileOrPath === 'string') {
      const result = await cloudinary.uploader.upload(fileOrPath, {
        folder,
        resource_type: 'auto',
        ...options,
      });
      return { url: result.secure_url, public_id: result.public_id };
    }

    // Vercel / serverless: multer file object with .buffer (memoryStorage)
    const buffer = fileOrPath.buffer || fileOrPath;
    if (!buffer) throw new Error('No file buffer or path provided to uploadToCloudinary');

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto', ...options },
        (error, result) => {
          if (error) return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          resolve(result);
        },
      );
      stream.end(buffer);
    });

    return { url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

const deleteFromCloudinary = async (publicId, options = {}) => {
  try {
    return await cloudinary.uploader.destroy(publicId, options);
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };

