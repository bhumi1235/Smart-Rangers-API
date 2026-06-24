import { body, validationResult } from "express-validator";
import { errorResponse } from "../utils/responseHandler.js";

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, errors.array()[0].msg);
    }
    next();
};

export const validateSignup = [
    body("name").notEmpty().withMessage("Name is required"),
    body("phone").matches(/^[0-9]{10,15}$/).withMessage("Invalid phone number format"),
    body("email").isEmail().withMessage("Invalid email format"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("player_id").notEmpty().withMessage("player_id is required"),
    body("device_type").notEmpty().withMessage("device_type is required"),
    body("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
    handleValidationErrors
];

export const validateLogin = [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("password").notEmpty().withMessage("Password is required"),
    body("player_id").notEmpty().withMessage("player_id is required"),
    body("device_type").notEmpty().withMessage("device_type is required"),
    handleValidationErrors
];

export const validateForgotPassword = [
    body("phone").matches(/^[0-9]{10,15}$/).withMessage("Invalid phone number format"),
    handleValidationErrors
];

export const validateResendOtp = [
    body("supervisorID").notEmpty().withMessage("Supervisor ID is required"),
    handleValidationErrors
];

export const validateVerifyOtp = [
    body("supervisorID").notEmpty().withMessage("Supervisor ID is required"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
    handleValidationErrors
];

export const validateResetPassword = [
    body("supervisorID").notEmpty().withMessage("Supervisor ID is required"),
    body("new_password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    handleValidationErrors
];

export const validateEditProfile = [
    body("email").optional().isEmail().withMessage("Invalid email format"),
    handleValidationErrors
];

export const validateUpdateSupervisor = [
    body("email").optional().isEmail().withMessage("Invalid email format"),
    body("phone").optional().matches(/^[0-9]{10,15}$/).withMessage("Invalid phone number format"),
    handleValidationErrors
];

export const validateChangePassword = [
    body("old_password").notEmpty().withMessage("Old password is required"),
    body("new_password").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
    handleValidationErrors
];

export const validateAddGuard = [
    body("name").notEmpty().withMessage("Name is required"),
    body("phone").matches(/^[0-9]{10,15}$/).withMessage("Invalid phone number format"),
    body("working_location").optional(),
    body("duty_type_id").optional(),
    handleValidationErrors
];
