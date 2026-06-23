import { pool } from "@workspace/db";
import app from "./app.js";
async function initCloudTables() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_machines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      brand TEXT NOT NULL,
      year INTEGER NOT NULL,
      serial_number TEXT NOT NULL,
      fleet_number TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cloud_operators (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      payment TEXT NOT NULL,
      weekly_hours TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cloud_rentals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      machine_revenues JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP NOT NULL
    );
  `);
    console.log("Cloud tables ready");
}
async function main() {
    const rawPort = process.env["PORT"];
    if (!rawPort) {
        throw new Error("PORT environment variable is required but was not provided.");
    }
    const port = Number(rawPort);
    if (Number.isNaN(port) || port <= 0) {
        throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
    await initCloudTables();
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map