import pool from "../src/config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    try {
        console.log("🔄 Running guard status migration...");

        // Read migration file
        const migrationPath = path.join(__dirname, "002_add_guard_status.sql");
        const migrationSQL = fs.readFileSync(migrationPath, "utf8");

        // Execute migration
        await pool.query(migrationSQL);

        console.log("✅ Migration completed successfully!");
        console.log("📊 All existing guards have been set to 'Active' status");

        // Verify migration
        const result = await pool.query("SELECT COUNT(*) as count FROM guards WHERE status = 'Active'");
        console.log(`✅ Active guards: ${result.rows[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
