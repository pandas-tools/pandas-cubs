// Runs pending Drizzle migrations. Invoked at deploy time on Railway:
//   "startCommand": "npm run db:migrate && npm run start"
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
