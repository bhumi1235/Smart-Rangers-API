import pool from "./src/config/db.js";
import bcrypt from "bcryptjs";

const resetAdmin = async () => {
    try {
        const email = "admin@example.com";
        const newPassword = "admin";

        console.log(`🔄 Resetting password for ${email} to "${newPassword}"...`);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const result = await pool.query(
            "UPDATE admins SET password = $1 WHERE email = $2",
            [hashedPassword, email]
        );

        if (result.rowCount === 0) {
            console.log("❌ Admin not found. Creating new admin...");
            await pool.query(
                "INSERT INTO admins (name, email, password) VALUES ($1, $2, $3)",
                ["Admin", email, hashedPassword]
            );
            console.log("✅ New admin created successfully!");
        } else {
            console.log("✅ Admin password reset successfully!");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Reset failed:", error);
        process.exit(1);
    }
};

resetAdmin();
