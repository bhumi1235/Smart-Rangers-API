import express from "express";
import { addGuard, getAllGuards, getGuardById, editGuard, deleteGuard, uploadGuardDocuments } from "../controllers/guardController.js";
import authenticateToken from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { validateAddGuard } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post(
    "/",
    upload.fields([
        { name: "profile_photo", maxCount: 1 },
        { name: "profileimage", maxCount: 1 },
        { name: "documents", maxCount: 10 },
    ]),
    validateAddGuard,
    addGuard
);
router.get("/", getAllGuards);
router.put(
    "/:id",
    upload.fields([
        { name: "profile_photo", maxCount: 1 },
        { name: "profileimage", maxCount: 1 },
        { name: "profileImage", maxCount: 1 },
        { name: "documents", maxCount: 10 },
    ]),
    editGuard
);
router.delete("/:id", deleteGuard);
router.post("/:id/documents", upload.array("documents", 10), uploadGuardDocuments);
router.get("/:id", getGuardById);

export default router;
