import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { generateToken } from "../utils/jwtUtils.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { sendPushNotification } from "../services/oneSignalService.js";
import { getFileUrl } from "../utils/fileUtils.js";

// Helper to format Supervisor ID
const formatSupervisorId = (id) => `SPR${String(id).padStart(3, '0')}`;

// Helper to extract ID from Supervisor ID string (SPRxxx -> xxx)
const parseSupervisorId = (sprId) => {
    if (!sprId || typeof sprId !== 'string') return null;
    const match = sprId.match(/SPR(\d+)/);
    return match ? parseInt(match[1], 10) : parseInt(sprId, 10); // Fallback to int if raw
};

// Employee Signup
export const signup = async (req, res, next) => {
    try {
        const { name, phone, email, password, player_id, device_type } = req.body;
        let profile_photo = null;

        if (req.files) {
            if (req.files["profile_photo"]) {
                const file = req.files["profile_photo"][0];
                profile_photo = file.path || file.filename;
            } else if (req.files["profileimage"]) {
                const file = req.files["profileimage"][0];
                profile_photo = file.path || file.filename;
            }
        }

        // Check if phone already exists
        const phoneCheck = await pool.query("SELECT * FROM employees WHERE phone = $1", [phone]);
        if (phoneCheck.rows.length > 0) {
            return errorResponse(res, "Phone number already registered.");
        }

        // Check if email already exists
        const emailCheck = await pool.query("SELECT * FROM employees WHERE email = $1", [email]);
        if (emailCheck.rows.length > 0) {
            return errorResponse(res, "Email id is already registered");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { rows } = await pool.query(
            "INSERT INTO employees (name, phone, email, password_hash, player_id, device_type, profile_photo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, phone, email, player_id, device_type, profile_photo",
            [name, phone, email, hashedPassword, player_id || null, device_type || null, profile_photo]
        );

        const newEmployee = rows[0];
        const token = generateToken({ id: newEmployee.id, phone: newEmployee.phone, role: "supervisor" });

        const userData = {
            supervisorID: formatSupervisorId(newEmployee.id), // Formatted ID
            name: newEmployee.name,
            phone: newEmployee.phone,
            email: newEmployee.email,
            player_id: newEmployee.player_id,
            device_type: newEmployee.device_type,
            role: "supervisor",
            profileImage: getFileUrl(newEmployee.profile_photo) // Cloudinary URL or local uploads URL
        };

        return successResponse(res, "Account created successfully.", {
            token,
            userData: userData
        });
    } catch (error) {
        // Check for Postgres Unique Violation (Code 23505) OR generic duplicate message
        if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
            if ((error.constraint && error.constraint.includes('email')) || (error.detail && error.detail.includes('email')) || (error.message && error.message.includes('email'))) {
                return errorResponse(res, "Email id is already registered");
            }
            if ((error.constraint && error.constraint.includes('phone')) || (error.detail && error.detail.includes('phone')) || (error.message && error.message.includes('phone'))) {
                return errorResponse(res, "Phone number already registered.");
            }
        }
        next(error);
    }
};

// Employee Login
export const login = async (req, res, next) => {
    try {
        const { phone, password, player_id, device_type } = req.body;

        const result = await pool.query("SELECT * FROM employees WHERE phone = $1", [phone]);

        if (result.rows.length === 0) {
            return errorResponse(res, "Phone number not registered");
        }

        const employee = result.rows[0];
        const isMatch = await bcrypt.compare(password, employee.password_hash);

        if (!isMatch) {
            return errorResponse(res, "Invalid password");
        }

        // Update device info if provided
        if (player_id || device_type) {
            await pool.query(
                "UPDATE employees SET player_id = COALESCE($1, player_id), device_type = COALESCE($2, device_type) WHERE id = $3",
                [player_id, device_type, employee.id]
            );
        }

        const token = generateToken({ id: employee.id, phone: employee.phone, role: "supervisor" });

        // Construct userData object (as requested)
        const userData = {
            supervisorID: formatSupervisorId(employee.id), // Formatted ID ("SPR001")
            name: employee.name,
            phone: employee.phone,
            email: employee.email,
            player_id: player_id || employee.player_id,
            device_type: device_type || employee.device_type,
            role: "supervisor",
            profileImage: getFileUrl(employee.profile_photo) // Cloudinary URL or local uploads URL
        };

        return successResponse(res, "Login successfully", {
            token,
            userData: userData
        });
    } catch (error) {
        next(error);
    }
};

// Forgot Password - Send OTP
export const forgotPassword = async (req, res, next) => {
    try {
        const { phone } = req.body;

        const result = await pool.query("SELECT * FROM employees WHERE phone = $1", [phone]);

        if (result.rows.length === 0) {
            return errorResponse(res, "Phone number not registered");
        }

        const employee = result.rows[0];
        const id = employee.id; // Get ID for OTP update

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await pool.query(
            "UPDATE employees SET otp_hash = $1, otp_expiry = $2 WHERE id = $3",
            [otpHash, otpExpiry, id]
        );

        console.log(`[MOCK SMS] OTP for ${phone}: ${otp}`);

        return successResponse(res, "OTP sent successfully", { otp, supervisorID: formatSupervisorId(employee.id) });

        return successResponse(res, "OTP sent successfully", { otp, supervisorID: formatSupervisorId(employee.id) });
    } catch (error) {
        next(error);
    }
};

// Resend OTP
export const resendOtp = async (req, res, next) => {
    try {
        const { supervisorID } = req.body;
        const id = parseSupervisorId(supervisorID);

        if (!id) return errorResponse(res, "Invalid Supervisor ID format");

        const result = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            return errorResponse(res, "User not found");
        }

        const employee = result.rows[0];

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await pool.query(
            "UPDATE employees SET otp_hash = $1, otp_expiry = $2 WHERE id = $3",
            [otpHash, otpExpiry, id]
        );

        console.log(`[MOCK SMS] Resend OTP for ${employee.phone}: ${otp}`);

        return successResponse(res, "OTP resent successfully", { otp });
    } catch (error) {
        next(error);
    }
};

// Verify OTP
export const verifyOtp = async (req, res, next) => {
    try {
        const { supervisorID, otp } = req.body;
        const id = parseSupervisorId(supervisorID);

        if (!id) return errorResponse(res, "Invalid Supervisor ID format");

        const result = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            return errorResponse(res, "Invalid Supervisor ID");
        }

        const employee = result.rows[0];

        if (!employee.otp_hash || !employee.otp_expiry) {
            return errorResponse(res, "No OTP requested");
        }

        if (new Date() > new Date(employee.otp_expiry)) {
            return errorResponse(res, "OTP expired");
        }

        const isMatch = await bcrypt.compare(otp, employee.otp_hash);
        if (!isMatch) {
            return errorResponse(res, "Invalid OTP");
        }

        return successResponse(res, "OTP verified");
    } catch (error) {
        next(error);
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    try {
        const { supervisorID, new_password } = req.body;
        const id = parseSupervisorId(supervisorID);

        if (!id) return errorResponse(res, "Invalid Supervisor ID format");

        const result = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            return errorResponse(res, "User not found");
        }

        const employee = result.rows[0];

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(new_password, salt);

        await pool.query(
            "UPDATE employees SET password_hash = $1, otp_hash = NULL, otp_expiry = NULL WHERE id = $2",
            [passwordHash, id]
        );

        return successResponse(res, "Password reset successfully", { supervisorID: formatSupervisorId(employee.id) });
    } catch (error) {
        next(error);
    }
};

// Edit Profile
export const editProfile = async (req, res, next) => {
    try {
        const userId = req.user.id; // From authMiddleware
        const { name, email, phone } = req.body;
        let profile_photo = undefined;

        if (req.files) {
            if (req.files["profile_photo"]) {
                const file = req.files["profile_photo"][0];
                profile_photo = file.path || file.filename;
            } else if (req.files["profileimage"]) {
                const file = req.files["profileimage"][0];
                profile_photo = file.path || file.filename;
            }
        }

        // Initialize update fields
        const fields = [];
        const values = [];
        let idx = 1;

        if (name) {
            fields.push(`name = $${idx++}`);
            values.push(name);
        }
        if (email) {
            fields.push(`email = $${idx++}`);
            values.push(email);
        }
        if (phone) {
            fields.push(`phone = $${idx++}`);
            values.push(phone);
        }
        if (profile_photo) {
            fields.push(`profile_photo = $${idx++}`);
            values.push(profile_photo);
        }

        if (fields.length === 0) {
            return errorResponse(res, "No fields to update");
        }

        values.push(userId);
        const query = `UPDATE employees SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, email, phone, profile_photo`;

        const result = await pool.query(query, values);

        const updatedUser = result.rows[0];
        const userData = {
            supervisorID: formatSupervisorId(updatedUser.id),
            name: updatedUser.name,
            phone: updatedUser.phone,
            email: updatedUser.email,
            profileImage: getFileUrl(updatedUser.profile_photo)
        };

        // Notify Supervisor
        // Correction: Let's fetch it to be safe.
        const currentUserResult = await pool.query("SELECT player_id FROM employees WHERE id = $1", [userId]);
        if (currentUserResult.rows.length > 0 && currentUserResult.rows[0].player_id) {
            await sendPushNotification([currentUserResult.rows[0].player_id], "Profile Updated", "You successfully updated your profile.");
        }

        return successResponse(res, "Profile updated successfully", { userData });
    } catch (error) {
        next(error);
    }
};

// Change Password
export const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { old_password, new_password } = req.body;

        const result = await pool.query("SELECT password_hash FROM employees WHERE id = $1", [userId]);
        if (result.rows.length === 0) return errorResponse(res, "User not found");

        const employee = result.rows[0];
        const isMatch = await bcrypt.compare(old_password, employee.password_hash);

        if (!isMatch) {
            return errorResponse(res, "Incorrect old password");
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(new_password, salt);

        await pool.query("UPDATE employees SET password_hash = $1 WHERE id = $2", [newHash, userId]);

        return successResponse(res, "Password changed successfully");
    } catch (error) {
        next(error);
    }
};

// Delete Account
export const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { password, reason } = req.body;

        if (!password) {
            return errorResponse(res, "Password is required to delete account");
        }

        const result = await pool.query("SELECT password_hash, phone FROM employees WHERE id = $1", [userId]);
        if (result.rows.length === 0) return errorResponse(res, "User not found");

        const employee = result.rows[0];
        const isMatch = await bcrypt.compare(password, employee.password_hash);

        if (!isMatch) {
            return errorResponse(res, "Incorrect password");
        }

        console.log(`[Delete Account] User ${employee.phone} deleting account. Reason: ${reason || "Not provided"}`);

        // Hard Delete
        await pool.query("DELETE FROM employees WHERE id = $1", [userId]);

        return successResponse(res, "Account deleted successfully");
    } catch (error) {
        next(error);
    }
};
