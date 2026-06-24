import pool from "../src/config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    try {
        console.log("🔄 Running status type correction migration...");

        const migrationPath = path.join(__dirname, "003_fix_status_to_string.sql");
        const migrationSQL = fs.readFileSync(migrationPath, "utf8");

        await pool.query(migrationSQL);

        console.log("✅ Migration completed successfully!");
        console.log("📊 Status columns for 'guards' and 'employees' are now VARCHAR strings.");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

runMigration();
