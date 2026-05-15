// Idempotent seed. Safe to re-run.
//
// Inserts:
//   - Orange Belgium client + `parallel9.com` allowed domain + English language + one store
//   - 3 dummy lessons, EN translations, all sharing the same Mux asset, all
//     assigned + published for Orange Belgium
//
// Admins are NOT seeded as user rows here — they materialize via Auth.js
// `events.createUser` callback the first time they sign in (the ADMIN_ALLOWLIST
// env var controls who is treated as an admin).
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import {
  clients,
  clientAllowedDomains,
  clientLanguages,
  stores,
  lessons,
  lessonTranslations,
  clientLessons,
} from "./schema";

// Mux asset created from https://muxed.s3.amazonaws.com/leds.mp4
// (Mux's own demo asset hosted on our account, ~17s). Public playback.
const DEMO_MUX_ASSET_ID = "w1Et18MayLnkM3T5yvJRRiHDFVXnWLg9nSMy2LKDHaY";
const DEMO_MUX_PLAYBACK_ID = "ksekcSdn1bbyWUsq6gyVE7QGd00027hD4dz2h300O8gLH4";
const DEMO_DURATION_SECONDS = 17;
const DEMO_THUMBNAIL_URL = `https://image.mux.com/${DEMO_MUX_PLAYBACK_ID}/thumbnail.jpg?time=1`;

const DEMO_LESSONS: {
  internalName: string;
  title: string;
  description: string;
  notesMarkdown: string;
  sortOrder: number;
}[] = [
  {
    internalName: "welcome-vision-ai",
    title: "Welcome to Pandas Vision AI",
    description:
      "A 30-second overview of what Vision AI does and how it helps you serve customers faster.",
    notesMarkdown:
      "## What you'll learn\n\n- What Vision AI assesses on a device\n- Where it sits in your customer journey\n- What the screens look like\n\n## Why it matters\n\nVision AI cuts device-assessment time from minutes to seconds and produces a consistent, defensible valuation — so customers leave with an answer they trust and you don't have to argue grade.",
    sortOrder: 10,
  },
  {
    internalName: "device-assessment-basics",
    title: "Running a Device Assessment",
    description:
      "Step-by-step: opening the assessment flow, scanning the device, and confirming the result.",
    notesMarkdown:
      "## Steps\n\n1. Tap **Start Assessment** on the home screen.\n2. Position the device per the on-screen guide.\n3. Let Vision AI run — it auto-detects model and condition.\n4. Confirm the grade and proceed to the offer.\n\n## Pro tip\n\nIf the camera flags something ambiguous, you can tap the area to manually mark it. The model retrains on those corrections.",
    sortOrder: 20,
  },
  {
    internalName: "common-issues-troubleshooting",
    title: "Common Issues & Troubleshooting",
    description:
      "The three things that go wrong most often, and how to fix them in under a minute.",
    notesMarkdown:
      "## 1. Camera won't focus\n\nUsually a smudged lens or low light. Wipe the lens and move closer to a window.\n\n## 2. Result seems off\n\nRe-scan with the device on a flat dark surface. Cluttered backgrounds can throw the detector.\n\n## 3. App crashes mid-scan\n\nForce-close and reopen. If it persists, restart the tablet. Persistent crashes — open a ticket via the support widget.",
    sortOrder: 30,
  },
];

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

  // 5. Demo lessons (idempotent — keyed off internal_name)
  for (const demo of DEMO_LESSONS) {
    let [lesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.internalName, demo.internalName))
      .limit(1);
    if (!lesson) {
      [lesson] = await db
        .insert(lessons)
        .values({
          internalName: demo.internalName,
          type: "training",
          sortOrder: demo.sortOrder,
          isPublished: true,
        })
        .returning();
      console.log(`  created lesson: ${demo.internalName}`);
    }

    // English translation pointing at our demo Mux asset
    const [existingT] = await db
      .select()
      .from(lessonTranslations)
      .where(
        and(
          eq(lessonTranslations.lessonId, lesson.id),
          eq(lessonTranslations.language, "en"),
        ),
      )
      .limit(1);
    if (!existingT) {
      await db.insert(lessonTranslations).values({
        lessonId: lesson.id,
        language: "en",
        title: demo.title,
        description: demo.description,
        notesMarkdown: demo.notesMarkdown,
        muxAssetId: DEMO_MUX_ASSET_ID,
        muxPlaybackId: DEMO_MUX_PLAYBACK_ID,
        durationSeconds: DEMO_DURATION_SECONDS,
        thumbnailUrl: DEMO_THUMBNAIL_URL,
      });
      console.log(`    added translation (en) for ${demo.internalName}`);
    }

    // Assign to Orange Belgium
    const [existingA] = await db
      .select()
      .from(clientLessons)
      .where(
        and(
          eq(clientLessons.clientId, orangeBE.id),
          eq(clientLessons.lessonId, lesson.id),
        ),
      )
      .limit(1);
    if (!existingA) {
      await db
        .insert(clientLessons)
        .values({ clientId: orangeBE.id, lessonId: lesson.id });
      console.log(`    assigned ${demo.internalName} to Orange Belgium`);
    }
  }

  console.log("Seed complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
