import express from "express";
// Auth middleware
import authenticateToken from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

// Validation
import {
    validateSignup,
    validateLogin,
    validateForgotPassword,
    validateVerifyOtp,
    validateResendOtp,
    validateResetPassword,
    validateEditProfile,
    validateChangePassword
} from "../middleware/validationMiddleware.js";

// Controllers
import {
    signup,
    login,
    forgotPassword,
    verifyOtp,
    resendOtp,
    resetPassword,
    editProfile,
    changePassword,
    deleteAccount
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", upload.fields([{ name: "profile_photo", maxCount: 1 }, { name: "profileimage", maxCount: 1 }]), validateSignup, signup);
router.post("/login", validateLogin, login);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/resend-otp", validateResendOtp, resendOtp);
router.post("/verify-otp", validateVerifyOtp, verifyOtp);
router.post("/reset-password", validateResetPassword, resetPassword);

// Protected Routes
router.use(authenticateToken);
router.put("/profile", upload.fields([{ name: "profile_photo", maxCount: 1 }, { name: "profileimage", maxCount: 1 }]), validateEditProfile, editProfile);
router.put("/change-password", validateChangePassword, changePassword);
router.delete("/account", deleteAccount);

export default router;
