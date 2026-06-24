import pool from "../config/db.js";
import { errorResponse } from "../utils/responseHandler.js";
import { getFileUrl } from "../utils/fileUtils.js";
import PDFDocument from "pdfkit";
import XLSX from "xlsx";

const formatSupervisorId = (id) => `SPR${String(id).padStart(3, "0")}`;
const formatGuardId = (id) => `G${String(id).padStart(3, "0")}`;

async function getSupervisorData(id) {
    const result = await pool.query(
        "SELECT id, name, email, phone, created_at, status, profile_photo, termination_reason FROM employees WHERE id = $1",
        [id]
    );
    if (result.rows.length === 0) return null;
    const s = result.rows[0];
    return {
        id: s.id,
        supervisorID: formatSupervisorId(s.id),
        fullName: s.name,
        email: s.email,
        phone: s.phone,
        status: s.status,
        createdDate: s.created_at,
        profileImage: getFileUrl(s.profile_photo),
        terminationReason: s.termination_reason || null
    };
}

async function getSupervisorGuardsData(supervisorId) {
    const result = await pool.query(
        "SELECT id, name, phone, working_location FROM guards WHERE supervisor_id = $1 ORDER BY id ASC",
        [supervisorId]
    );
    return result.rows.map(g => ({
        id: formatGuardId(g.local_guard_id || g.id),
        name: g.name,
        phone: g.phone,
        area: g.working_location
    }));
}

async function getGuardData(id) {
    const guardResult = await pool.query(
        `SELECT g.*, dt.name as duty_type_name 
         FROM guards g LEFT JOIN duty_types dt ON g.duty_type_id = dt.id 
         WHERE g.id = $1`,
        [id]
    );
    if (guardResult.rows.length === 0) return null;
    const guard = guardResult.rows[0];
    const contactsResult = await pool.query(
        "SELECT name, phone FROM emergency_contacts WHERE guard_id = $1 ORDER BY id ASC",
        [guard.id]
    );
    const docsResult = await pool.query(
        "SELECT original_name, file_path FROM documents WHERE guard_id = $1",
        [guard.id]
    );
    const contacts = contactsResult.rows;
    const documents = docsResult.rows.map((d) => ({
        name: d.original_name,
        url: getFileUrl(d.file_path)
    }));
    return {
        id: guard.id,
        guardID: formatGuardId(guard.local_guard_id || guard.id),
        fullName: guard.name,
        phone: guard.phone,
        email: guard.email,
        address: guard.current_address,
        permanentAddress: guard.permanent_address,
        emergencyAddress: guard.emergency_address,
        assignedArea: guard.working_location,
        dutyType: guard.duty_type_name,
        dutyStartTime: guard.duty_start_time,
        dutyEndTime: guard.duty_end_time,
        dateOfJoining: guard.created_at,
        workExperience: guard.work_experience,
        referenceBy: guard.reference_by,
        emergencyContact1: contacts[0] ? `${contacts[0].name} - ${contacts[0].phone}` : null,
        emergencyContact2: contacts[1] ? `${contacts[1].name} - ${contacts[1].phone}` : null,
        documents: documents
    };
}

export const exportSupervisorPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getSupervisorData(id);
        if (!data) return errorResponse(res, "Supervisor not found", 404);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="supervisor-${data.supervisorID}.pdf"`
        );

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);
        doc.fontSize(18).text("Supervisor Details", { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`ID: ${data.supervisorID}`);
        doc.text(`Name: ${data.fullName || "-"}`);
        doc.text(`Email: ${data.email || "-"}`);
        doc.text(`Phone: ${data.phone || "-"}`);
        doc.text(`Status: ${data.status || "-"}`);
        doc.text(`Joined: ${data.createdDate ? new Date(data.createdDate).toLocaleDateString() : "-"}`);
        if (data.terminationReason) doc.text(`Termination Reason: ${data.terminationReason}`);

        // Add Guards section
        const guards = await getSupervisorGuardsData(id);
        if (guards && guards.length > 0) {
            doc.moveDown();
            doc.fontSize(14).text("Assigned Guards", { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);

            // Header
            doc.text("ID", 50, doc.y, { continued: true });
            doc.text("Name", 150, doc.y, { continued: true });
            doc.text("Phone", 300, doc.y, { continued: true });
            doc.text("Working Location", 450, doc.y);
            doc.text("------------------------------------------------------------------------------------------------------------------");

            guards.forEach(g => {
                doc.text(g.id, 50, doc.y, { continued: true });
                doc.text(g.name || "-", 150, doc.y, { continued: true });
                doc.text(g.phone || "-", 300, doc.y, { continued: true });
                doc.text(g.area || "-", 450, doc.y);
            });
        } else {
            doc.moveDown();
            doc.fontSize(12).text("No guards assigned to this supervisor.");
        }

        doc.end();
    } catch (error) {
        console.error("[ExportSupervisorPdf] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

export const exportSupervisorExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getSupervisorData(id);
        if (!data) return errorResponse(res, "Supervisor not found", 404);

        const ws = XLSX.utils.json_to_sheet([
            {
                "Supervisor ID": data.supervisorID,
                "Full Name": data.fullName,
                "Email": data.email,
                "Phone": data.phone,
                "Status": data.status,
                "Date of Joining": data.createdDate ? new Date(data.createdDate).toISOString().split("T")[0] : "",
                "Termination Reason": data.terminationReason || ""
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Supervisor");

        // Add Guards sheet
        const guards = await getSupervisorGuardsData(id);
        if (guards && guards.length > 0) {
            const wsGuards = XLSX.utils.json_to_sheet(guards.map(g => ({
                "Guard ID": g.id,
                "Name": g.name,
                "Phone": g.phone,
                "Working Location": g.area
            })));
            XLSX.utils.book_append_sheet(wb, wsGuards, "Assigned Guards");
        }
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="supervisor-${data.supervisorID}.xlsx"`
        );
        res.send(buf);
    } catch (error) {
        console.error("[ExportSupervisorExcel] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

export const exportGuardPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getGuardData(id);
        if (!data) return errorResponse(res, "Guard not found", 404);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="guard-${data.guardID}.pdf"`
        );

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);
        doc.fontSize(18).text("Guard Details", { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Guard ID: ${data.guardID}`);
        doc.text(`Name: ${data.fullName || "-"}`);
        doc.text(`Phone: ${data.phone || "-"}`);
        doc.text(`Email: ${data.email || "-"}`);
        doc.text(`Address: ${data.address || "-"}`);
        doc.text(`Assigned Area: ${data.assignedArea || "-"}`);
        doc.text(`Duty Type: ${data.dutyType || "-"}`);
        doc.text(`Duty Time: ${data.dutyStartTime || "-"} - ${data.dutyEndTime || "-"}`);
        doc.text(`Date of Joining: ${data.dateOfJoining ? new Date(data.dateOfJoining).toLocaleDateString() : "-"}`);
        doc.text(`Emergency Contact 1: ${data.emergencyContact1 || "-"}`);
        doc.text(`Emergency Contact 2: ${data.emergencyContact2 || "-"}`);
        doc.text(`Work Experience: ${data.workExperience || "-"}`);
        doc.text(`Reference: ${data.referenceBy || "-"}`);
        doc.end();
    } catch (error) {
        console.error("[ExportGuardPdf] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};

export const exportGuardExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await getGuardData(id);
        if (!data) return errorResponse(res, "Guard not found", 404);

        const ws = XLSX.utils.json_to_sheet([
            {
                "Guard ID": data.guardID,
                "Full Name": data.fullName,
                "Phone": data.phone,
                "Email": data.email,
                "Address": data.address,
                "Assigned Area": data.assignedArea,
                "Duty Type": data.dutyType,
                "Duty Start": data.dutyStartTime,
                "Duty End": data.dutyEndTime,
                "Date of Joining": data.dateOfJoining ? new Date(data.dateOfJoining).toISOString().split("T")[0] : "",
                "Emergency Contact 1": data.emergencyContact1 || "",
                "Emergency Contact 2": data.emergencyContact2 || "",
                "Work Experience": data.workExperience || "",
                "Reference": data.referenceBy || ""
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Guard");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="guard-${data.guardID}.xlsx"`
        );
        res.send(buf);
    } catch (error) {
        console.error("[ExportGuardExcel] Error:", error);
        return errorResponse(res, "Server error", 500);
    }
};
