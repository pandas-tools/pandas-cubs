"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  clients,
  clientAllowedDomains,
  clientLanguages,
} from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function createClient(input: { name: string; slug?: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const name = input.name.trim();
  if (!name) return { error: "Name is required" };
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
  if (!slug) return { error: "Slug could not be derived" };

  // Reject duplicates
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .limit(1);
  if (existing) return { error: `Slug "${slug}" is already taken` };

  const [created] = await db
    .insert(clients)
    .values({ name, slug })
    .returning();
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return { ok: true, clientId: created.id };
}

export async function updateClient(input: {
  id: string;
  name?: string;
  slug?: string;
  isActive?: boolean;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Name cannot be empty" };
    patch.name = name;
  }
  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    if (!slug) return { error: "Slug cannot be empty" };
    const [conflict] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.slug, slug)))
      .limit(1);
    if (conflict && conflict.id !== input.id) {
      return { error: `Slug "${slug}" is already taken` };
    }
    patch.slug = slug;
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  await db.update(clients).set(patch).where(eq(clients.id, input.id));
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${input.id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteClient(clientId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  // Cascade is set on FKs (allowed_domains, languages, stores, etc.) so
  // a single delete is sufficient. lesson_completions belong to users —
  // those are also FK'd to users.client_id so they go with the users.
  await db.delete(clients).where(eq(clients.id, clientId));
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect("/admin/clients");
}

export async function addAllowedDomain(input: {
  clientId: string;
  domain: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const domain = input.domain
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/^https?:\/\//, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { error: "Not a valid domain" };
  }
  const [existing] = await db
    .select()
    .from(clientAllowedDomains)
    .where(
      and(
        eq(clientAllowedDomains.clientId, input.clientId),
        eq(clientAllowedDomains.domain, domain),
      ),
    )
    .limit(1);
  if (existing) return { error: `${domain} is already on the allowlist` };

  await db
    .insert(clientAllowedDomains)
    .values({ clientId: input.clientId, domain });
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true };
}

export async function removeAllowedDomain(input: {
  clientId: string;
  domain: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .delete(clientAllowedDomains)
    .where(
      and(
        eq(clientAllowedDomains.clientId, input.clientId),
        eq(clientAllowedDomains.domain, input.domain),
      ),
    );
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true };
}

const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de", "es", "it", "pt"] as const;

export async function addLanguage(input: {
  clientId: string;
  language: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const lang = input.language.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(lang as (typeof SUPPORTED_LANGUAGES)[number])) {
    return { error: `Language "${lang}" is not supported` };
  }
  await db
    .insert(clientLanguages)
    .values({ clientId: input.clientId, language: lang })
    .onConflictDoNothing();
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true };
}

export async function removeLanguage(input: {
  clientId: string;
  language: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .delete(clientLanguages)
    .where(
      and(
        eq(clientLanguages.clientId, input.clientId),
        eq(clientLanguages.language, input.language),
      ),
    );
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true };
}
