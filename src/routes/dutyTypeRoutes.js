import express from "express";
import {
    getAllDutyTypes,
    getDutyTypeById,
    createDutyType,
    updateDutyType,
    deleteDutyType
} from "../controllers/dutyTypeController.js";
//import authenticateToken from "../middleware/authMiddleware.js";
//import authenticateAdmin from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

router.get("/", getAllDutyTypes);        // List all
router.get("/:id", getDutyTypeById);     // Get one (for Edit)
router.post("/", createDutyType);        // Create
router.put("/:id", updateDutyType);      // Update
router.delete("/:id", deleteDutyType);   // Delete

export default router;
