import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "storage", "app.db");

if (fs.existsSync(dbPath)) {
  console.log(`DB ready: ${dbPath}`);
} else {
  console.log("DB not initialized yet.");
}
