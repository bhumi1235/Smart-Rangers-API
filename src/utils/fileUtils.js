import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

/**
 * Get the correct file URL based on environment
 * @param {string} filename - The filename or full URL
 * @returns {string} - The complete URL to access the file
 */
export const getFileUrl = (filename) => {
    if (!filename) return null;

    // If it's already a full URL (Cloudinary), return as-is
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
        return filename;
    }

    // For local files, return relative path
    return `/uploads/${filename}`;
};

/**
 * Check if a URL is from Cloudinary
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export const isCloudinaryUrl = (url) => {
    return url && url.includes('cloudinary.com');
};

/**
 * Delete a file from local storage or Cloudinary
 * @param {string} filePathOrUrl - Local file path or Cloudinary URL
 */
export const deleteFile = async (filePathOrUrl) => {
    if (!filePathOrUrl) return;

    try {
        if (isCloudinaryUrl(filePathOrUrl)) {
            // Extract public_id from Cloudinary URL
            // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
            const urlParts = filePathOrUrl.split('/');
            const fileWithExt = urlParts[urlParts.length - 1];
            const publicId = fileWithExt.split('.')[0];

            // Delete from Cloudinary
            await cloudinary.uploader.destroy(`smart-rangers/${publicId}`);
            console.log(`[FileUtils] Deleted from Cloudinary: ${publicId}`);
        } else {
            // Delete from local storage
            const filePath = filePathOrUrl.startsWith('/uploads/')
                ? filePathOrUrl.replace('/uploads/', 'uploads/')
                : filePathOrUrl;

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[FileUtils] Deleted local file: ${filePath}`);
            }
        }
    } catch (error) {
        console.error('[FileUtils] Error deleting file:', error);
    }
};

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} - Cloudinary URL
 */
export const uploadToCloudinary = async (filePath, folder = 'smart-rangers') => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: 'auto'
        });

        // Delete local file after successful upload
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return result.secure_url;
    } catch (error) {
        console.error('[FileUtils] Error uploading to Cloudinary:', error);
        throw error;
    }
};
