import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";

// Get all notifications for logged-in supervisor
export const getNotifications = async (req, res) => {
    try {
        const supervisor_id = req.user.id;
        // Order by LOCAL ID descending (newest first)
        const result = await pool.query(
            "SELECT * FROM notifications WHERE supervisor_id = $1 ORDER BY local_notification_id ASC",
            [supervisor_id]
        );
        // Format response to use local_notification_id as id
        const formattedNotifications = result.rows.map(notif => ({
            id: notif.local_notification_id,
            type: notif.type,
            message: notif.message,
            is_read: notif.is_read,
            created_at: notif.created_at
        }));

        return successResponse(res, "Notifications fetched successfully", { notifications: formattedNotifications });
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server error", 500);
    }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
    const { id } = req.params; // treating id param as local_notification_id
    const supervisor_id = req.user.id;
    try {
        if (id === "all") {
            await pool.query("UPDATE notifications SET is_read = TRUE WHERE supervisor_id = $1", [supervisor_id]);
            return successResponse(res, "All notifications marked as read");
        }

        // Use local_notification_id
        await pool.query("UPDATE notifications SET is_read = TRUE WHERE local_notification_id = $1 AND supervisor_id = $2", [
            id, supervisor_id
        ]);
        return successResponse(res, "Notification marked as read");
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server error", 500);
    }
};

// Delete one notification
export const deleteNotification = async (req, res) => {
    const { id } = req.params; // treating id param as local_notification_id
    const supervisor_id = req.user.id;
    try {
        // Use local_notification_id
        const result = await pool.query("DELETE FROM notifications WHERE local_notification_id = $1 AND supervisor_id = $2 RETURNING *", [id, supervisor_id]);
        if (result.rows.length === 0) {
            return errorResponse(res, "Notification not found or unauthorized", 404);
        }
        return successResponse(res, "Notification deleted successfully");
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server error", 500);
    }
};

// Delete all notifications
export const deleteAllNotifications = async (req, res) => {
    const supervisor_id = req.user.id;
    try {
        await pool.query("DELETE FROM notifications WHERE supervisor_id = $1", [supervisor_id]);
        return successResponse(res, "All notifications deleted successfully");
    } catch (error) {
        console.error(error);
        return errorResponse(res, "Server error", 500);
    }
};
