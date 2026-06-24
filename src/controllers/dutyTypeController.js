import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";

// Get all duty types
export const getAllDutyTypes = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM duty_types ORDER BY name ASC");
        return successResponse(res, "Duty types fetched successfully", { duty_types: result.rows });
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server Error", 500);
    }
};

// Create a new duty type
export const createDutyType = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return errorResponse(res, "Duty type name is required");

        const result = await pool.query(
            "INSERT INTO duty_types (name) VALUES ($1) RETURNING *",
            [name]
        );
        return successResponse(res, "Duty type created successfully", { duty_type: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            return errorResponse(res, "Duty type already exists");
        }
        console.error(error);
        return errorResponse(res, "Server Error", 500);
    }
};


// Update a duty type
export const updateDutyType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) return errorResponse(res, "Duty type name is required");

        const result = await pool.query(
            "UPDATE duty_types SET name = $1 WHERE id = $2 RETURNING *",
            [name, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, "Duty type not found", 404);
        }

        return successResponse(res, "Duty type updated successfully", { duty_type: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return errorResponse(res, "Duty type already exists");
        }
        console.error(error);
        return errorResponse(res, "Server Error", 500);
    }
};

// Get a single duty type by ID
export const getDutyTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM duty_types WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return errorResponse(res, "Duty type not found", 404);
        }

        return successResponse(res, "Duty type fetched successfully", { duty_type: result.rows[0] });
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server Error", 500);
    }
};

// Delete a duty type
export const deleteDutyType = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM duty_types WHERE id = $1 RETURNING *", [id]);

        if (result.rows.length === 0) {
            return errorResponse(res, "Duty type not found", 404);
        }

        return successResponse(res, "Duty type deleted successfully");
    } catch (error) {
        console.error(error);
        // Check for foreign key violation (e.g., if used by guards/logs)
        if (error.code === '23503') {
            return errorResponse(res, "Cannot delete duty type as it is currently in use");
        }
        return errorResponse(res, "Server Error", 500);
    }
};
