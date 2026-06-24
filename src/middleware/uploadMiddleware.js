import multer from "multer";
import path from "path";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Check file type
function checkFileType(file, cb) {
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb("Error: Images and Documents Only!");
    }
}

// Determine storage based on environment
const getStorage = () => {
    const hasCloudinary =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
        // Prefer Cloudinary whenever credentials are configured
        console.log("[Upload Middleware] Using Cloudinary storage");
        return new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: "smart-rangers",
                allowed_formats: ["jpeg", "jpg", "png", "gif", "pdf", "doc", "docx"],
                transformation: [{ width: 500, height: 500, crop: "limit" }],
            },
        });
    } else {
        // Fallback: local storage
        console.log("[Upload Middleware] Using local storage");
        return multer.diskStorage({
            destination: "./uploads/",
            filename: function (req, file, cb) {
                cb(
                    null,
                    file.fieldname + "-" + Date.now() + path.extname(file.originalname)
                );
            },
        });
    }
};

// Init upload
const upload = multer({
    storage: getStorage(),
    limits: { fileSize: 10000000 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

export default upload;
