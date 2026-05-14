import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __cubs_pg: postgres.Sql | undefined;
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

// In dev, reuse the connection across HMR reloads.
const sql =
  global.__cubs_pg ??
  postgres(url, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__cubs_pg = sql;
}

export const db = drizzle(sql, { schema, logger: false });
export { sql as pg };
export * from "./schema";
