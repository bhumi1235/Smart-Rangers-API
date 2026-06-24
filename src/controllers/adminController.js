import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwtUtils.js";
import { getFileUrl, deleteFile } from "../utils/fileUtils.js";

// Admin Login
export const login = async (req, res) => {
    try {
        let { email, password, player_id } = req.body;
        email = email.trim().toLowerCase();
        console.log(`[Admin Login] Attempt for email: ${email}`);

        const result = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            console.log(`[Admin Login] User not found: ${email}`);
            return errorResponse(res, "User not found. Please create an admin first.");
        }

        const admin = result.rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            console.log(`[Admin Login] Password mismatch for: ${email}`);
            return errorResponse(res, "Incorrect password.");
        }

        // Update player_id if provided
        if (player_id) {
            await pool.query("UPDATE admins SET player_id = $1 WHERE id = $2", [player_id, admin.id]);
        }

        console.log(`[Admin Login] Success for: ${email}`);
        const token = generateToken({ id: admin.id, email: admin.email, role: "admin" });

        return successResponse(res, "Admin login successful", {
            token,
            userData: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: "admin",
                player_id: player_id || admin.player_id, // Return player_id
                created_at: admin.created_at
            }
        });
    } catch (error) {
        console.error("[Admin Login] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Get Dashboard Stats
export const getDashboardStats = async (req, res) => {
    try {
        const [totalGuards, totalSupervisors, supervisorCounts, recentGuards] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM guards"),
            pool.query("SELECT COUNT(*) FROM employees"),
            pool.query(
                "SELECT status, COUNT(*) as count FROM employees GROUP BY status"
            ),
            pool.query("SELECT * FROM guards ORDER BY created_at DESC LIMIT 5")
        ]);

        const statusCounts = (rows) => {
            const map = { Active: 0, Suspended: 0, Terminated: 0 };
            rows.forEach(r => { map[r.status] = parseInt(r.count, 10); });
            return map;
        };
        const supervisorByStatus = statusCounts(supervisorCounts.rows);
        const totalGuardsCount = parseInt(totalGuards.rows[0].count, 10);
        const guardByStatus = { Active: totalGuardsCount, Suspended: 0, Terminated: 0 };

        const stats = {
            totalGuards: parseInt(totalGuards.rows[0].count),
            totalSupervisors: parseInt(totalSupervisors.rows[0].count),
            totalActiveSupervisors: supervisorByStatus.Active,
            totalSuspendedSupervisors: supervisorByStatus.Suspended,
            totalTerminatedSupervisors: supervisorByStatus.Terminated,
            totalActiveGuards: guardByStatus.Active,
            totalSuspendedGuards: guardByStatus.Suspended,
            totalTerminatedGuards: guardByStatus.Terminated,
            recentGuards: recentGuards.rows
        };

        return successResponse(res, "Dashboard stats fetched successfully", stats);
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server error", 500);
    }
};

// Helper to format Supervisor ID
const formatSupervisorId = (id) => `SPR${String(id).padStart(3, '0')}`;

// Get All Supervisors
export const getAllSupervisors = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, phone, created_at, profile_photo, status, termination_reason FROM employees ORDER BY created_at DESC"
        );

        console.log(`[GetSupervisors] Found ${result.rows.length} records.`);

        const formattedSupervisors = result.rows.map(sup => ({
            id: sup.id,
            supervisorID: formatSupervisorId(sup.id),
            fullName: sup.name, // Frontend expects 'fullName'
            email: sup.email,
            phone: sup.phone,
            status: sup.status, // "Active"
            date_of_joining: sup.created_at,
            profileImage: getFileUrl(sup.profile_photo),
            terminationReason: sup.termination_reason || null
        }));

        console.log(`[GetSupervisors] Sending array of length:`, formattedSupervisors.length);

        return res.status(200).json({
            success: true,
            message: "Supervisors fetched successfully",
            data: formattedSupervisors
        });
    } catch (error) {
        console.error("[GetSupervisors] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Toggle Supervisor Status (if needed, or just standard edit)
// For now, let's just assume we list them. 
// If specific management actions needed:
// export const updateSupervisorStatus = ...

// DEBUG: List all admins
export const listAdmins = async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email, created_at FROM admins");
        return successResponse(res, "Admin List", result.rows);
    } catch (error) {
        return errorResponse(res, "Server error", 500);
    }
};

// Create a new Admin
export const createAdmin = async (req, res) => {
    try {
        let { name, phone, email, password } = req.body;
        email = email.trim().toLowerCase();
        console.log(`[Create Admin] Request for: ${email}`);

        // Basic duplicate check
        const check = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
        if (check.rows.length > 0) {
            console.log(`[Create Admin] Already exists: ${email}`);
            return errorResponse(res, "Admin already exists");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
            "INSERT INTO admins (name, email, password) VALUES ($1, $2, $3)",
            [name, email, hashedPassword]
        );

        console.log(`[Create Admin] Created successfully: ${email}`);
        return successResponse(res, "Admin created successfully");
    } catch (error) {
        console.error("[Create Admin] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Get Supervisor Details by ID
export const getSupervisorById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "SELECT id, name, email, phone, created_at, status, profile_photo, termination_reason FROM employees WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Supervisor not found", 404);
        }

        const s = result.rows[0];
        const supervisorDetails = {
            id: s.id,
            fullName: s.name,
            email: s.email,
            phone: s.phone,
            status: s.status,
            createdDate: s.created_at,
            profileImage: getFileUrl(s.profile_photo),
            terminationReason: s.termination_reason || null
        };

        return res.status(200).json({
            success: true,
            message: "Supervisor details fetched successfully",
            data: supervisorDetails
        });
    } catch (error) {
        console.error("[GetSupervisorById] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Get Guards for a specific Supervisor
export const getSupervisorGuards = async (req, res) => {
    try {
        const { id } = req.params; // Supervisor ID

        // Query guards for this supervisor
        const result = await pool.query(
            "SELECT id, name, phone, working_location, 'Active' as status FROM guards WHERE supervisor_id = $1 ORDER BY created_at DESC",
            [id]
        );

        const formattedGuards = result.rows.map(g => ({
            id: g.id,
            fullName: g.name,           // Map name -> fullName
            phone: g.phone,
            assignedArea: g.working_location, // Map working_location -> assignedArea
            status: g.status
        }));

        return res.status(200).json({
            success: true,
            message: "Supervisor guards fetched successfully",
            data: formattedGuards
        });
    } catch (error) {
        console.error("[GetSupervisorGuards] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Update Supervisor Status (Suspend/Activate)
export const updateSupervisorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status value
        const validStatuses = ['Active', 'Suspended'];
        if (!status || !validStatuses.includes(status)) {
            return errorResponse(res, "Invalid status. Must be 'Active' or 'Suspended'", 400);
        }

        // Update status
        const result = await pool.query(
            "UPDATE employees SET status = $1 WHERE id = $2 RETURNING id, name, status",
            [status, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Supervisor not found", 404);
        }

        console.log(`[UpdateSupervisorStatus] Supervisor ${id} status changed to ${status}`);
        return successResponse(res, `Supervisor ${status === 'Active' ? 'activated' : 'suspended'} successfully`, {
            supervisor: result.rows[0]
        });
    } catch (error) {
        console.error("[UpdateSupervisorStatus] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Create Supervisor (Admin Only)
export const createSupervisor = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        let profile_photo = null;

        if (req.files) {
            if (req.files["profile_photo"]) {
                // Cloudinary returns 'path', local multer returns 'filename'
                profile_photo = req.files["profile_photo"][0].path || req.files["profile_photo"][0].filename;
            } else if (req.files["profileimage"]) {
                profile_photo = req.files["profileimage"][0].path || req.files["profileimage"][0].filename;
            }
        }

        // Check if phone already exists
        const phoneCheck = await pool.query("SELECT * FROM employees WHERE phone = $1", [phone]);
        if (phoneCheck.rows.length > 0) {
            return errorResponse(res, "Phone number already registered");
        }

        // Check if email already exists
        if (email) {
            const emailCheck = await pool.query("SELECT * FROM employees WHERE email = $1", [email]);
            if (emailCheck.rows.length > 0) {
                return errorResponse(res, "Email already registered");
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { rows } = await pool.query(
            "INSERT INTO employees (name, phone, email, password_hash, profile_photo, status) VALUES ($1, $2, $3, $4, $5, 'Active') RETURNING id, name, phone, email, profile_photo, status, created_at",
            [name, phone, email || null, hashedPassword, profile_photo]
        );

        const newSupervisor = rows[0];
        const supervisorID = formatSupervisorId(newSupervisor.id);
        console.log(`[CreateSupervisor] Admin created supervisor: ${newSupervisor.name} (ID: ${supervisorID})`);

        return successResponse(res, "Supervisor created successfully", {
            supervisor: {
                supervisorID,
                id: newSupervisor.id,
                name: newSupervisor.name,
                phone: newSupervisor.phone,
                email: newSupervisor.email,
                profile_photo: getFileUrl(newSupervisor.profile_photo),
                status: newSupervisor.status,
                created_at: newSupervisor.created_at
            }
        });
    } catch (error) {
        console.error("[CreateSupervisor] Error:", error);
        if (error.code === '23505') {
            if (error.detail.includes('phone')) return errorResponse(res, "Phone number already registered");
            if (error.detail.includes('email')) return errorResponse(res, "Email already registered");
        }
        return errorResponse(res, "Server error", 500);
    }
};

// Update Supervisor Details
export const updateSupervisor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone } = req.body;
        let profile_photo = undefined;

        if (req.file) {
            // Cloudinary returns 'path', local multer returns 'filename'
            profile_photo = req.file.path || req.file.filename;

            // Fetch current photo to delete it
            const currentPhotoResult = await pool.query("SELECT profile_photo FROM employees WHERE id = $1", [id]);
            if (currentPhotoResult.rows.length > 0) {
                const oldPhoto = currentPhotoResult.rows[0].profile_photo;
                if (oldPhoto) {
                    // Delete old file (works for both local and Cloudinary)
                    await deleteFile(oldPhoto);
                }
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

        values.push(id);
        const query = `UPDATE employees SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, email, phone, profile_photo, status`;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return errorResponse(res, "Supervisor not found", 404);
        }

        const updatedUser = result.rows[0];
        // Format for frontend
        const userData = {
            id: updatedUser.id,
            supervisorID: formatSupervisorId(updatedUser.id),
            fullName: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            status: updatedUser.status,
            profileImage: getFileUrl(updatedUser.profile_photo)
        };

        return successResponse(res, "Supervisor updated successfully", userData);
    } catch (error) {
        console.error("[UpdateSupervisor] Error:", error);
        // Check for unique constraint violations
        if (error.code === '23505') {
            if (error.detail.includes('email')) return errorResponse(res, "Email already in use");
            if (error.detail.includes('phone')) return errorResponse(res, "Phone already in use");
        }
        return errorResponse(res, "Server error", 500);
    }
};

// Delete Supervisor (Soft Delete - Set status to Terminated)
export const deleteSupervisor = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Soft delete: Set status to 'Terminated' and store reason
        const result = await pool.query(
            "UPDATE employees SET status = 'Terminated', termination_reason = $1 WHERE id = $2 RETURNING id, name, termination_reason",
            [reason || null, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Supervisor not found", 404);
        }

        console.log(`[DeleteSupervisor] Supervisor ${id} (${result.rows[0].name}) terminated. Reason: ${reason || 'Not provided'}`);
        return successResponse(res, "Supervisor terminated successfully", {
            supervisor: {
                id: result.rows[0].id,
                name: result.rows[0].name,
                termination_reason: result.rows[0].termination_reason
            }
        });
    } catch (error) {
        console.error("[DeleteSupervisor] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Permanently delete a terminated supervisor (only when status is Terminated)
export const permanentDeleteSupervisor = async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query(
            "SELECT id, name, status FROM employees WHERE id = $1",
            [id]
        );
        if (check.rows.length === 0) {
            return errorResponse(res, "Supervisor not found", 404);
        }
        if (check.rows[0].status !== "Terminated") {
            return errorResponse(res, "Only terminated supervisors can be permanently deleted", 400);
        }
        await pool.query("DELETE FROM employees WHERE id = $1", [id]);
        console.log(`[PermanentDeleteSupervisor] Permanently deleted supervisor ${id} (${check.rows[0].name})`);
        return successResponse(res, "Supervisor permanently deleted", { id: parseInt(id, 10) });
    } catch (error) {
        console.error("[PermanentDeleteSupervisor] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Permanently delete a guard (admin only; cascade deletes contacts & documents)
export const permanentDeleteGuard = async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query("SELECT id, name FROM guards WHERE id = $1", [id]);
        if (check.rows.length === 0) {
            return errorResponse(res, "Guard not found", 404);
        }
        await pool.query("DELETE FROM guards WHERE id = $1", [id]);
        console.log(`[PermanentDeleteGuard] Permanently deleted guard ${id} (${check.rows[0].name})`);
        return successResponse(res, "Guard permanently deleted", { id: parseInt(id, 10) });
    } catch (error) {
        console.error("[PermanentDeleteGuard] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Update Termination Reason
export const updateTerminationReason = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return errorResponse(res, "Termination reason is required");
        }

        const result = await pool.query(
            "UPDATE employees SET termination_reason = $1 WHERE id = $2 AND status = 'Terminated' RETURNING id, name, termination_reason",
            [reason, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Terminated supervisor not found", 404);
        }

        console.log(`[UpdateTerminationReason] Updated reason for supervisor ${id}: ${reason}`);
        return successResponse(res, "Termination reason updated successfully", {
            supervisor: {
                id: result.rows[0].id,
                name: result.rows[0].name,
                termination_reason: result.rows[0].termination_reason
            }
        });
    } catch (error) {
        console.error("[UpdateTerminationReason] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Get Admin Profile
export const getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id;

        const result = await pool.query(
            "SELECT id, name, email, created_at FROM admins WHERE id = $1",
            [adminId]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Admin not found", 404);
        }

        const admin = result.rows[0];
        return successResponse(res, "Admin profile fetched successfully", {
            userData: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: "admin",
                created_at: admin.created_at
            }
        });
    } catch (error) {
        console.error("[GetAdminProfile] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};



// Get List of Uploaded Files
export const getUploadedFiles = async (req, res) => {
    try {
        const uploadsDir = path.join(process.cwd(), "uploads");

        // Check if uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
            return successResponse(res, "Uploads directory does not exist", {
                files: [],
                message: "No uploads directory found. It will be created when first file is uploaded."
            });
        }

        // Read all files in the uploads directory
        const files = fs.readdirSync(uploadsDir);

        // Get file details
        const fileDetails = files.map(filename => {
            const filePath = path.join(uploadsDir, filename);
            const stats = fs.statSync(filePath);

            return {
                filename,
                url: getFileUrl(filename),
                size: stats.size,
                sizeKB: (stats.size / 1024).toFixed(2),
                created: stats.birthtime,
                modified: stats.mtime,
                isDirectory: stats.isDirectory()
            };
        }).filter(file => !file.isDirectory); // Only return files, not directories

        return successResponse(res, "Uploaded files retrieved successfully", {
            count: fileDetails.length,
            files: fileDetails
        });
    } catch (error) {
        console.error("[GetUploadedFiles] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Update Guard Status (Suspend/Activate)
export const updateGuardStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['Active', 'Suspended', 'Terminated'];
        if (!status || !validStatuses.includes(status)) {
            return errorResponse(res, "Invalid status. Must be 'Active', 'Suspended', or 'Terminated'", 400);
        }

        let query = "UPDATE guards SET status = $1 WHERE id = $2 RETURNING id, name, status, termination_reason";
        let params = [status, id];

        if (status === 'Active') {
            query = "UPDATE guards SET status = $1, termination_reason = NULL WHERE id = $2 RETURNING id, name, status, termination_reason";
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return errorResponse(res, "Guard not found", 404);
        }

        console.log(`[UpdateGuardStatus] Guard ${id} status changed to ${status}${status === 'Active' ? ' (Reason cleared)' : ''}`);
        return successResponse(res, `Guard ${status} successfully`, {
            guard: result.rows[0]
        });
    } catch (error) {
        console.error("[UpdateGuardStatus] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Terminate Guard (Soft Delete - Admin version)
export const terminateGuard = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await pool.query(
            "UPDATE guards SET status = 'Terminated', termination_reason = $1 WHERE id = $2 RETURNING id, name, termination_reason",
            [reason || null, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Guard not found", 404);
        }

        console.log(`[TerminateGuard] Guard ${id} (${result.rows[0].name}) terminated by Admin. Reason: ${reason || 'Not provided'}`);
        return successResponse(res, "Guard terminated successfully", {
            guard: result.rows[0]
        });
    } catch (error) {
        console.error("[TerminateGuard] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Update Guard Termination Reason
export const updateGuardTerminationReason = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return errorResponse(res, "Termination reason is required");
        }

        const result = await pool.query(
            "UPDATE guards SET termination_reason = $1 WHERE id = $2 AND status = 'Terminated' RETURNING id, name, termination_reason",
            [reason, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Terminated guard not found", 404);
        }

        console.log(`[UpdateGuardTerminationReason] Updated reason for guard ${id}: ${reason}`);
        return successResponse(res, "Termination reason updated successfully", {
            guard: {
                id: result.rows[0].id,
                name: result.rows[0].name,
                termination_reason: result.rows[0].termination_reason
            }
        });
    } catch (error) {
        console.error("[UpdateGuardTerminationReason] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};
