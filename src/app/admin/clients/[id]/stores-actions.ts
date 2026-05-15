"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clients, stores } from "@/lib/db/schema";

async function requireAdminClient(clientId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  // Verify client exists
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) throw new Error("Client not found");
  return { session, client };
}

export async function addStore(input: {
  clientId: string;
  name: string;
  city?: string;
  countryCode?: string;
  externalId?: string;
}) {
  try {
    await requireAdminClient(input.clientId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const name = input.name.trim();
  if (!name) return { error: "Name is required" };

  const [created] = await db
    .insert(stores)
    .values({
      clientId: input.clientId,
      name,
      city: input.city?.trim() || null,
      countryCode: input.countryCode?.trim().toUpperCase() || null,
      externalId: input.externalId?.trim() || null,
    })
    .returning();
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath("/admin");
  return { ok: true, storeId: created.id };
}

export async function updateStore(input: {
  storeId: string;
  clientId: string;
  name?: string;
  city?: string | null;
  countryCode?: string | null;
  externalId?: string | null;
  isActive?: boolean;
}) {
  try {
    await requireAdminClient(input.clientId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  // Verify the store belongs to this client
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1);
  if (!store || store.clientId !== input.clientId) {
    return { error: "Store does not belong to this client" };
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Name cannot be empty" };
    patch.name = name;
  }
  if (input.city !== undefined)
    patch.city = input.city?.trim() || null;
  if (input.countryCode !== undefined)
    patch.countryCode = input.countryCode?.trim().toUpperCase() || null;
  if (input.externalId !== undefined)
    patch.externalId = input.externalId?.trim() || null;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  await db.update(stores).set(patch).where(eq(stores.id, input.storeId));
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true };
}

export async function deleteStore(input: { storeId: string; clientId: string }) {
  try {
    await requireAdminClient(input.clientId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  await db
    .delete(stores)
    .where(
      and(eq(stores.id, input.storeId), eq(stores.clientId, input.clientId)),
    );
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Minimal CSV parser. Handles:
 *  - Optional header row (auto-detected by column names)
 *  - Commas inside quoted fields ("Foo, Bar")
 *  - Escaped quotes inside quoted fields ("She said ""hi""")
 *  - CRLF or LF line endings
 *  - Trailing newlines and blank lines
 *
 * Returns array of { name, city?, countryCode?, externalId? } records.
 */
function parseCsv(input: string): {
  rows: {
    name: string;
    city?: string;
    countryCode?: string;
    externalId?: string;
  }[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = parseLines(input);
  if (lines.length === 0) return { rows: [], errors: ["Empty CSV"] };

  // Auto-detect header
  const headerCandidates = lines[0].map((c) => c.toLowerCase().trim());
  const expectedHeaders = ["name", "city", "country_code", "external_id"];
  const hasHeader = headerCandidates.some((h) => expectedHeaders.includes(h));

  let columnOrder: (keyof Record<string, string> | null)[] = [
    "name",
    "city",
    "countryCode",
    "externalId",
  ];

  let dataLines = lines;
  if (hasHeader) {
    columnOrder = headerCandidates.map((h) => {
      switch (h) {
        case "name":
          return "name";
        case "city":
          return "city";
        case "country_code":
        case "country":
        case "countrycode":
          return "countryCode";
        case "external_id":
        case "externalid":
        case "id":
          return "externalId";
        default:
          return null;
      }
    });
    if (!columnOrder.includes("name")) {
      errors.push("CSV must have a 'name' column");
      return { rows: [], errors };
    }
    dataLines = lines.slice(1);
  }

  const rows: ReturnType<typeof parseCsv>["rows"] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const cells = dataLines[i];
    if (cells.every((c) => c.trim() === "")) continue;
    const record: Record<string, string> = {};
    for (let j = 0; j < cells.length; j++) {
      const key = columnOrder[j];
      if (key) record[key] = cells[j].trim();
    }
    if (!record.name) {
      errors.push(
        `Row ${i + (hasHeader ? 2 : 1)}: missing name`,
      );
      continue;
    }
    rows.push({
      name: record.name,
      city: record.city || undefined,
      countryCode: record.countryCode || undefined,
      externalId: record.externalId || undefined,
    });
  }
  return { rows, errors };
}

function parseLines(input: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"' && field === "") {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        current.push(field);
        if (current.some((c) => c !== "")) lines.push(current);
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    if (current.some((c) => c !== "")) lines.push(current);
  }
  return lines;
}

export async function importStoresCsv(input: {
  clientId: string;
  csv: string;
}): Promise<
  | { ok: true; inserted: number; skipped: number; errors: string[] }
  | { error: string }
> {
  try {
    await requireAdminClient(input.clientId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const { rows, errors } = parseCsv(input.csv);
  if (rows.length === 0 && errors.length > 0) {
    return { error: errors.join("; ") };
  }

  // De-dupe on external_id (within the same client) — if a store with the
  // same external_id exists, skip it. This makes re-running an import safe.
  const existing = await db
    .select()
    .from(stores)
    .where(eq(stores.clientId, input.clientId));
  const existingByExternalId = new Map<string, true>();
  for (const s of existing) {
    if (s.externalId) existingByExternalId.set(s.externalId, true);
  }

  let inserted = 0;
  let skipped = 0;
  const toInsert: (typeof stores.$inferInsert)[] = [];
  for (const row of rows) {
    if (row.externalId && existingByExternalId.has(row.externalId)) {
      skipped++;
      continue;
    }
    toInsert.push({
      clientId: input.clientId,
      name: row.name,
      city: row.city ?? null,
      countryCode: row.countryCode?.toUpperCase() ?? null,
      externalId: row.externalId ?? null,
    });
  }
  if (toInsert.length > 0) {
    const result = await db.insert(stores).values(toInsert).returning();
    inserted = result.length;
  }
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath("/admin");
  return { ok: true, inserted, skipped, errors };
}
