// Idempotent seed. Safe to re-run.
//
// Inserts:
//   - Orange Belgium client + `parallel9.com` allowed domain + English language + one store
//
// Admins are NOT seeded as user rows here — they materialize via Auth.js
// `events.createUser` callback the first time they sign in (the ADMIN_ALLOWLIST
// env var controls who is treated as an admin).
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import {
  clients,
  clientAllowedDomains,
  clientLanguages,
  stores,
} from "./schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log("Seeding…");

  // 1. Orange Belgium client
  const slug = "orange-belgium";
  let [orangeBE] = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug));
  if (!orangeBE) {
    [orangeBE] = await db
      .insert(clients)
      .values({ name: "Orange Belgium", slug })
      .returning();
    console.log("  created client: Orange Belgium");
  } else {
    console.log("  client already exists: Orange Belgium");
  }

  // 2. Allowed domain
  const existingDomain = await db
    .select()
    .from(clientAllowedDomains)
    .where(eq(clientAllowedDomains.clientId, orangeBE.id));
  const hasParallel9 = existingDomain.some((d) => d.domain === "parallel9.com");
  if (!hasParallel9) {
    await db.insert(clientAllowedDomains).values({
      clientId: orangeBE.id,
      domain: "parallel9.com",
    });
    console.log("  added allowed domain: parallel9.com");
  } else {
    console.log("  allowed domain already exists: parallel9.com");
  }

  // 3. Languages — English
  const existingLangs = await db
    .select()
    .from(clientLanguages)
    .where(eq(clientLanguages.clientId, orangeBE.id));
  if (!existingLangs.some((l) => l.language === "en")) {
    await db
      .insert(clientLanguages)
      .values({ clientId: orangeBE.id, language: "en" });
    console.log("  added language: en");
  }

  // 4. Seed store
  const existingStores = await db
    .select()
    .from(stores)
    .where(eq(stores.clientId, orangeBE.id));
  if (existingStores.length === 0) {
    await db.insert(stores).values({
      clientId: orangeBE.id,
      name: "Orange Store Antwerp Central",
      city: "Antwerp",
      countryCode: "BE",
    });
    console.log("  added store: Orange Store Antwerp Central");
  }

  console.log("Seed complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
