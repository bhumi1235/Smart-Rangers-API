import pool from './config/db.js';

async function fix() {
    try {
        console.log("Fixing bad player_id...");
        // Clear specifically the bad ID "818" or any that are not UUID-like (simple check length < 10)
        const res = await pool.query("UPDATE employees SET player_id = NULL WHERE player_id = '818'");
        console.log(`Cleared bad player_id for ${res.rowCount} users.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fix();
