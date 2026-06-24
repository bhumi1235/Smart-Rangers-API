import express from "express";
import { getDashboardStats, getAllSupervisors, getSupervisorById, getSupervisorGuards, createSupervisor, updateSupervisorStatus, updateSupervisor, deleteSupervisor, permanentDeleteSupervisor, terminateGuard, permanentDeleteGuard, updateTerminationReason, createAdmin, login, listAdmins, getAdminProfile, getUploadedFiles, updateGuardStatus, updateGuardTerminationReason } from "../controllers/adminController.js";
import { getAllGuards } from "../controllers/guardController.js";
import { exportSupervisorPdf, exportSupervisorExcel, exportGuardPdf, exportGuardExcel } from "../controllers/exportController.js";
import authenticateAdmin from "../middleware/adminAuthMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { validateUpdateSupervisor } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.get("/debug-users", listAdmins); // Public Debug
router.post("/login", login);
router.post("/create-admin", createAdmin); // Public for bootstrapping

router.use(authenticateAdmin);

router.get("/dashboard", getDashboardStats);
router.get("/supervisors", getAllSupervisors);
router.get("/guards", getAllGuards);
router.post("/supervisors", upload.fields([{ name: "profile_photo", maxCount: 1 }, { name: "profileimage", maxCount: 1 }]), createSupervisor);
router.get("/supervisors/:id", getSupervisorById);
router.get("/supervisors/:id/guards", getSupervisorGuards);
router.get("/supervisors/:id/export/pdf", exportSupervisorPdf);
router.get("/supervisors/:id/export/excel", exportSupervisorExcel);
router.put("/supervisors/:id", upload.single("profile_photo"), validateUpdateSupervisor, updateSupervisor);
router.put("/supervisors/:id/status", updateSupervisorStatus);
router.delete("/supervisors/:id", deleteSupervisor);
router.delete("/supervisors/:id/permanent", permanentDeleteSupervisor);
router.put("/supervisors/:id/termination-reason", updateTerminationReason);

router.put("/guards/:id/status", updateGuardStatus);
router.delete("/guards/:id", terminateGuard);
router.put("/guards/:id/termination-reason", updateGuardTerminationReason);
router.delete("/guards/:id/permanent", permanentDeleteGuard);
router.get("/guards/:id/export/pdf", exportGuardPdf);
router.get("/guards/:id/export/excel", exportGuardExcel);

// Admin Profile Management
router.get("/profile", getAdminProfile);

// Uploads Management
router.get("/uploads", getUploadedFiles);

export default router;
