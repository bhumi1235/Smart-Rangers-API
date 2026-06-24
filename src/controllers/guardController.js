import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { sendPushNotification } from "../services/oneSignalService.js";
import { getFileUrl } from "../utils/fileUtils.js";

// Helper to format Supervisor ID
const formatSupervisorId = (id) => `SPR${String(id).padStart(3, '0')}`;

// Helper to format Guard ID
const formatGuardId = (id) => `G${String(id).padStart(3, '0')}`;
// Helper to parse Guard ID
const parseGuardId = (id) => {
    if (!id) return null;
    const numericId = id.toString().replace(/^G/i, '');
    const parsed = parseInt(numericId, 10);
    return isNaN(parsed) ? null : parsed;
};

// Add a new guard
export const addGuard = async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const {
            name,
            phone,
            email,
            current_address,
            permanent_address,
            emergency_address,
            duty_type_id,
            duty_start_time,
            duty_end_time,
            working_location,
            work_experience,
            reference_by,
            emergency_contact_name_1,
            emergency_contact_phone_1,
            emergency_contact_name_2,
            emergency_contact_phone_2
        } = req.body;

        // Validate Duty Type ID
        // Ensure duty_type_id is not undefined before querying
        if (duty_type_id) {
            const dutyTypeCheck = await client.query("SELECT * FROM duty_types WHERE id = $1", [duty_type_id]);
            if (dutyTypeCheck.rows.length === 0) {
                await client.query("ROLLBACK");
                return errorResponse(res, "Invalid duty type selected");
            }
        }

        // Handle Profile Photo (Support both keys)
        let profile_photo = null;
        if (req.files) {
            if (req.files["profileimage"]) {
                profile_photo = req.files["profileimage"][0].path || req.files["profileimage"][0].filename;
            } else if (req.files["profile_photo"]) {
                profile_photo = req.files["profile_photo"][0].path || req.files["profile_photo"][0].filename;
            }
        }

        // Identify Supervisor
        const supervisor_id = req.user ? req.user.id : null;

        // Determine Per-Supervisor Guard ID
        let local_guard_id = 1;
        if (supervisor_id) {
            const maxIdResult = await client.query(
                "SELECT MAX(local_guard_id) as max_id FROM guards WHERE supervisor_id = $1",
                [supervisor_id]
            );
            if (maxIdResult.rows.length > 0 && maxIdResult.rows[0].max_id) {
                local_guard_id = maxIdResult.rows[0].max_id + 1;
            }
        }

        // Insert Guard (using duty_type_id, supervisor_id, local_guard_id)
        // Use || null to ensure undefined values are passed as null to Postgres
        const guardResult = await client.query(
            `INSERT INTO guards (
            name, profile_photo, phone, email, current_address, permanent_address, emergency_address,
            duty_type_id, duty_start_time, duty_end_time, working_location, work_experience, reference_by,
            supervisor_id, local_guard_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'Active') RETURNING id, local_guard_id, status`,
            [
                name || null,
                profile_photo || null,
                phone || null,
                email || null,
                current_address || null,
                permanent_address || null,
                emergency_address || null,
                duty_type_id || null,
                duty_start_time || null,
                duty_end_time || null,
                working_location || null,
                work_experience || null,
                reference_by || null,
                supervisor_id,
                local_guard_id
            ]
        );

        const guardId = guardResult.rows[0].id;
        const localGuardId = guardResult.rows[0].local_guard_id;
        const guardStatus = guardResult.rows[0].status;

        // Insert Emergency Contacts
        if (emergency_contact_name_1 && emergency_contact_phone_1) {
            await client.query(
                "INSERT INTO emergency_contacts (guard_id, name, phone) VALUES ($1, $2, $3)",
                [guardId, emergency_contact_name_1, emergency_contact_phone_1]
            );
        }
        if (emergency_contact_name_2 && emergency_contact_phone_2) {
            await client.query(
                "INSERT INTO emergency_contacts (guard_id, name, phone) VALUES ($1, $2, $3)",
                [guardId, emergency_contact_name_2, emergency_contact_phone_2]
            );
        }

        // Insert Documents
        const uploadedDocuments = [];
        if (req.files && req.files["documents"]) {
            for (const file of req.files["documents"]) {
                const filePath = file.path || file.filename;
                await client.query(
                    "INSERT INTO documents (guard_id, file_path, original_name) VALUES ($1, $2, $3)",
                    [guardId, filePath, file.originalname]
                );
                uploadedDocuments.push({
                    file_path: filePath,
                    original_name: file.originalname
                });
            }
        }

        // Create Notification linked to Supervisor with Local unique ID
        let notificationResult = null;
        if (supervisor_id) {
            try {
                const maxNotifId = await client.query(
                    "SELECT MAX(local_notification_id) as max_id FROM notifications WHERE supervisor_id = $1",
                    [supervisor_id]
                );
                const local_notification_id = (maxNotifId.rows[0].max_id || 0) + 1;

                await client.query(
                    "INSERT INTO notifications (type, message, supervisor_id, local_notification_id) VALUES ($1, $2, $3, $4)",
                    ["GUARD_ADDED", `New guard added: ${name}`, supervisor_id, local_notification_id]
                );

                // Notify Supervisor via Push
                const supervisorEmp = await client.query("SELECT player_id FROM employees WHERE id = $1", [supervisor_id]);
                if (supervisorEmp.rows.length > 0 && supervisorEmp.rows[0].player_id) {
                    notificationResult = await sendPushNotification([supervisorEmp.rows[0].player_id], "Guard Added", `You successfully added guard: ${name}`);
                }
            } catch (notificationError) {
                console.error("Notification Error (Non-blocking):", notificationError);
                // Swallow error so guard creation succeeds
                notificationResult = { error: "Notification failed but guard created" };
            }
        }

        // Fetch Duty Type Name
        let duty_type_name = "Unknown";
        if (duty_type_id) {
            const dutyTypeResult = await client.query("SELECT name FROM duty_types WHERE id = $1", [duty_type_id]);
            duty_type_name = dutyTypeResult.rows[0]?.name || "Unknown";
        }

        await client.query("COMMIT");

        return successResponse(res, "Guard added successfully", {
            guardData: {
                guardID: formatGuardId(localGuardId || guardId),
                supervisorID: req.user ? formatSupervisorId(req.user.id) : null,
                supervisorName: req.user?.name || "Admin",
                name,
                phone,
                email,
                profile_photo: getFileUrl(profile_photo),
                current_address,
                permanent_address,
                date_of_joining: new Date(), // Approximate for immediate response
                duty_start_time,
                duty_end_time,
                duty_type_name,
                assigned_location: working_location,
                work_experience,
                reference_by,
                emergency_contact_name_1,
                emergency_contact_phone_1,
                emergency_contact_name_2,
                emergency_contact_phone_2,
                emergency_address,
                status: guardStatus,
                documents: uploadedDocuments
            },
            notificationResult: notificationResult
        }, 201); // 201 Created

    } catch (error) {
        if (client) await client.query("ROLLBACK");
        console.error("addGuard ERROR:", error);
        if (error.code === '23505') {
            return errorResponse(res, "Phone number already exists for another guard", 400);
        }
        if (error.code === '23503') {
            return errorResponse(res, "Invalid Supervisor or Duty Type (Please try logging in again)", 400);
        }
        return errorResponse(res, "Server error: " + error.message, 500);
    } finally {
        if (client) client.release();
    }
};

// Delete Guard
export const deleteGuard = async (req, res) => {
    try {
        const { id } = req.params; // Database ID
        const supervisor_id = req.user ? req.user.id : null;

        if (!supervisor_id && req.user?.role !== 'admin') {
            return errorResponse(res, "Unauthorized", 401);
        }

        // Find the guard by database ID
        let guardQuery = `SELECT id, name, supervisor_id FROM guards WHERE id = $1`;
        let queryParams = [parseInt(id, 10)];

        // Add supervisor check for non-admin users
        if (req.user?.role !== 'admin') {
            guardQuery += ` AND supervisor_id = $2`;
            queryParams.push(supervisor_id);
        }

        const guardResult = await pool.query(guardQuery, queryParams);

        if (guardResult.rows.length === 0) {
            return errorResponse(res, "Guard not found", 404);
        }

        const guard = guardResult.rows[0];

        // Fetch Supervisor Name for notification (if supervisor is deleting)
        let supervisorName = "Unknown";
        if (req.user?.role !== 'admin') {
            supervisorName = req.user.name || "Unknown";
        }

        // Soft delete: Set status to 'Terminated' and optionally store reason if provided in req.body.reason
        // (If simple delete button is pressed, reason might be null, but status becomes Terminated)
        const reason = req.body.reason || "Terminated by supervisor";
        await pool.query("UPDATE guards SET status = 'Terminated', termination_reason = $1 WHERE id = $2", [reason, guard.id]);

        // Notify Supervisor
        let notificationResult = null;
        if (supervisor_id) {
            const supervisorEmp = await pool.query("SELECT player_id FROM employees WHERE id = $1", [supervisor_id]);
            if (supervisorEmp.rows.length > 0 && supervisorEmp.rows[0].player_id) {
                notificationResult = await sendPushNotification([supervisorEmp.rows[0].player_id], "Guard Deleted", `You successfully deleted guard: ${guard.name}`);
            }
        }

        return successResponse(res, "Guard deleted successfully", { notificationResult });

    } catch (error) {
        console.error("[deleteGuard] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Get all guards (with search)
export const getAllGuards = async (req, res) => {
    const { search } = req.query;
    try {
        const supervisor_id = req.user?.id;
        const isAdmin = req.user?.role === 'admin';

        console.log(`[getAllGuards] Request by ${isAdmin ? 'Admin' : 'Supervisor'}. supervisor_id: ${supervisor_id}, search: ${search}`);

        let query = `
        SELECT g.*, dt.name as duty_type_name 
        FROM guards g 
        LEFT JOIN duty_types dt ON g.duty_type_id = dt.id`;

        let params = [];

        // Admin: Show all guards. Supervisor: Show only own guards.
        if (!isAdmin && supervisor_id) {
            query += " WHERE g.supervisor_id = $1";
            params.push(supervisor_id);
        }

        if (search) {
            if (!isAdmin && supervisor_id) {
                query += " AND g.name ILIKE $2";
                params.push(`%${search}%`);
            } else {
                query += " WHERE g.name ILIKE $1";
                params.push(`%${search}%`);
            }
        }

        query += " ORDER BY g.created_at DESC";

        const result = await pool.query(query, params);

        // Format for frontend: flat array with specific field names
        const formattedGuards = result.rows.map(guard => ({
            id: guard.id,
            guardID: formatGuardId(guard.local_guard_id || guard.id),
            fullName: guard.name,  // Frontend expects fullName
            phone: guard.phone,
            email: guard.email,
            assignedArea: guard.working_location,  // Frontend expects assignedArea
            supervisorId: guard.supervisor_id,  // Frontend expects supervisorId
            status: guard.status || 'Active',
            terminationReason: guard.termination_reason || null,
            profileImage: getFileUrl(guard.profile_photo),
            dutyType: guard.duty_type_name,
            dateOfJoining: guard.created_at
        }));

        return res.status(200).json({
            success: true,
            message: "Guards fetched successfully",
            data: formattedGuards
        });
    } catch (error) {
        console.error("[getAllGuards] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Get single guard details
export const getGuardById = async (req, res) => {
    const { id } = req.params;
    const supervisor_id = req.user ? req.user.id : null;

    if (!supervisor_id && req.user?.role !== 'admin') {
        return errorResponse(res, "Unauthorized: Supervisor ID missing", 401);
    }

    const local_id = parseGuardId(id);
    if (!local_id) {
        return errorResponse(res, "Invalid Guard ID format");
    }

    try {
        // Admin can see any guard. Supervisor can only see own.
        let guardQuery = `
        SELECT g.*, dt.name as duty_type_name 
        FROM guards g 
        LEFT JOIN duty_types dt ON g.duty_type_id = dt.id
        WHERE g.id = $1
    `;
        const queryParams = [id];

        if (req.user?.role !== 'admin') {
            guardQuery += " AND g.supervisor_id = $2";
            queryParams.push(supervisor_id);
        }

        const guardResult = await pool.query(guardQuery, queryParams);

        if (guardResult.rows.length === 0) {
            return errorResponse(res, "Guard not found", 404);
        }

        const guard = guardResult.rows[0];

        // Fetch related data
        const contactsResult = await pool.query(
            "SELECT * FROM emergency_contacts WHERE guard_id = $1 ORDER BY id ASC",
            [guard.id]
        );

        const contacts = contactsResult.rows;

        // Fetch documents
        const documentsResult = await pool.query(
            "SELECT original_name, file_path FROM documents WHERE guard_id = $1",
            [guard.id]
        );
        const documents = documentsResult.rows.map(doc => ({
            original_name: doc.original_name,
            file_path: getFileUrl(doc.file_path)
        }));

        // Format response to match frontend expectations
        const guardDetails = {
            id: guard.id,
            guardID: formatGuardId(guard.local_guard_id || guard.id),
            fullName: guard.name,  // Frontend expects fullName
            phone: guard.phone,
            email: guard.email,
            address: guard.current_address,  // Frontend expects address
            emergencyContact: contacts[0]?.phone || null,  // Frontend expects single emergencyContact
            assignedArea: guard.working_location,  // Frontend expects assignedArea
            supervisorId: guard.supervisor_id,  // Frontend expects supervisorId
            status: guard.status || 'Active',
            terminationReason: guard.termination_reason || null,
            profileImage: getFileUrl(guard.profile_photo),
            dutyType: guard.duty_type_name,
            dateOfJoining: guard.created_at,
            // Additional fields for detailed view
            permanentAddress: guard.permanent_address,
            emergencyAddress: guard.emergency_address,
            dutyStartTime: guard.duty_start_time,
            dutyEndTime: guard.duty_end_time,
            workExperience: guard.work_experience,
            referenceBy: guard.reference_by,
            emergencyContactName1: contacts[0]?.name || null,
            emergencyContactPhone1: contacts[0]?.phone || null,
            emergencyContactName2: contacts[1]?.name || null,
            emergencyContactName2: contacts[1]?.name || null,
            emergencyContactPhone2: contacts[1]?.phone || null,
            documents: documents // Add documents to response
        };

        return res.status(200).json({
            success: true,
            message: "Guard details fetched successfully",
            data: guardDetails
        });
    } catch (error) {
        console.error("[getGuardById] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

// Edit Guard
export const editGuard = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params; // local_guard_id or Gxxx
        const supervisor_id = req.user ? req.user.id : null;

        const local_id = parseGuardId(id);

        if (!supervisor_id) {
            client.release();
            return errorResponse(res, "Unauthorized: Supervisor ID missing", 401);
        }

        await client.query("BEGIN");

        // NOTE: We update by local_guard_id + supervisor_id
        // First get the real ID to update related tables
        const guardQuery = `SELECT id FROM guards WHERE local_guard_id = $1 AND supervisor_id = $2`;
        const guardResult = await client.query(guardQuery, [local_id, supervisor_id]);

        if (guardResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return errorResponse(res, "Guard not found", 404);
        }

        const realGuardId = guardResult.rows[0].id;

        const {
            name,
            phone,
            email,
            current_address,
            permanent_address,
            emergency_address,
            duty_type_id,
            duty_start_time,
            duty_end_time,
            working_location,
            work_experience,
            reference_by,
            emergency_contact_name_1,
            emergency_contact_phone_1,
            emergency_contact_name_2,
            emergency_contact_phone_2
        } = req.body;

        // Update Guard Fields
        const updates = [];
        const values = [];
        let idx = 1;

        const addField = (col, val) => {
            if (val !== undefined) {
                updates.push(`${col} = $${idx++}`);
                values.push(val);
            }
        };

        addField("name", name);
        addField("phone", phone);
        addField("email", email);
        addField("current_address", current_address);
        addField("permanent_address", permanent_address);
        addField("emergency_address", emergency_address);
        addField("duty_type_id", duty_type_id);
        addField("duty_start_time", duty_start_time);
        addField("duty_end_time", duty_end_time);
        addField("working_location", working_location);
        addField("work_experience", work_experience);
        addField("reference_by", reference_by);

        if (req.files) {
            if (req.files["profile_photo"]) {
                addField("profile_photo", req.files["profile_photo"][0].path || req.files["profile_photo"][0].filename);
            } else if (req.files["profileimage"]) {
                addField("profile_photo", req.files["profileimage"][0].path || req.files["profileimage"][0].filename);
            } else if (req.files["profileImage"]) {
                addField("profile_photo", req.files["profileImage"][0].path || req.files["profileImage"][0].filename);
            }
        }

        if (updates.length > 0) {
            values.push(realGuardId);
            await client.query(
                `UPDATE guards SET ${updates.join(", ")} WHERE id = $${idx}`,
                values
            );
        }

        // Update Emergency Contacts (Delete all and re-insert is simpler)
        if (emergency_contact_name_1 || emergency_contact_name_2) {
            await client.query("DELETE FROM emergency_contacts WHERE guard_id = $1", [realGuardId]);

            if (emergency_contact_name_1 && emergency_contact_phone_1) {
                await client.query(
                    "INSERT INTO emergency_contacts (guard_id, name, phone) VALUES ($1, $2, $3)",
                    [realGuardId, emergency_contact_name_1, emergency_contact_phone_1]
                );
            }
            if (emergency_contact_name_2 && emergency_contact_phone_2) {
                await client.query(
                    "INSERT INTO emergency_contacts (guard_id, name, phone) VALUES ($1, $2, $3)",
                    [realGuardId, emergency_contact_name_2, emergency_contact_phone_2]
                );
            }
        }

        // Documents (Append new documents)
        if (req.files && req.files["documents"]) {
            for (const file of req.files["documents"]) {
                const filePath = file.path || file.filename;
                await client.query(
                    "INSERT INTO documents (guard_id, file_path, original_name) VALUES ($1, $2, $3)",
                    [realGuardId, filePath, file.originalname]
                );
            }
        }

        await client.query("COMMIT");

        // Return updated details logic (reuse formatted response logic if possible, or just message)
        // User asked for "Edit" api, usually implies returning the updated object or just success.
        // Assuming success message is sufficient for now, or minimal data.
        return successResponse(res, "Guard details updated successfully");

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        if (error.code === '23505') {
            return errorResponse(res, "Phone number already exists for another guard", 400);
        }
        return errorResponse(res, "Server error", 500);
    } finally {
        client.release();
    }
};

// Upload multiple documents for a guard
export const uploadGuardDocuments = async (req, res) => {
    try {
        const { id } = req.params; // Guard ID (Gxxx or local_guard_id)
        const supervisor_id = req.user ? req.user.id : null;
        const local_id = parseGuardId(id);

        if (!local_id) return errorResponse(res, "Invalid Guard ID format");

        // Verify Guard Exists & Authorization
        let guardQuery = `SELECT id FROM guards WHERE local_guard_id = $1`;
        let queryParams = [local_id];

        if (req.user?.role !== 'admin') {
            if (!supervisor_id) return errorResponse(res, "Unauthorized", 401);
            guardQuery += ` AND supervisor_id = $2`;
            queryParams.push(supervisor_id);
        }

        const guardResult = await pool.query(guardQuery, queryParams);

        if (guardResult.rows.length === 0) {
            return errorResponse(res, "Guard not found", 404);
        }

        const realGuardId = guardResult.rows[0].id;

        if (!req.files || req.files.length === 0) {
            return errorResponse(res, "No files uploaded", 400);
        }

        const uploadedDocuments = [];
        for (const file of req.files) {
            const filePath = file.path || file.filename;
            await pool.query(
                "INSERT INTO documents (guard_id, file_path, original_name) VALUES ($1, $2, $3)",
                [realGuardId, filePath, file.originalname]
            );
            uploadedDocuments.push({
                file_path: filePath,
                original_name: file.originalname
            });
        }

        return successResponse(res, "Documents uploaded successfully", { documents: uploadedDocuments });

    } catch (error) {
        console.error("[uploadGuardDocuments] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};
