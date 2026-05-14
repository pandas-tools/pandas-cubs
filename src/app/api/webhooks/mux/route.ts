import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lessonTranslations } from "@/lib/db/schema";
import { verifyMuxSignature } from "@/lib/mux";

type AssetReadyData = {
  id: string;
  upload_id?: string;
  playback_ids?: { id: string; policy: string }[];
  duration?: number;
};

type UploadAssetCreatedData = {
  id: string;
  asset_id: string;
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("mux-signature");
  if (!verifyMuxSignature(rawBody, sig)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    type: string;
    data: AssetReadyData | UploadAssetCreatedData;
  };

  switch (payload.type) {
    case "video.upload.asset_created": {
      const data = payload.data as UploadAssetCreatedData;
      await db
        .update(lessonTranslations)
        .set({ muxAssetId: data.asset_id })
        .where(eq(lessonTranslations.muxUploadId, data.id));
      break;
    }
    case "video.asset.ready": {
      const data = payload.data as AssetReadyData;
      const playbackId = data.playback_ids?.[0]?.id;
      if (!playbackId) break;

      // Build thumbnail URL — Mux serves time-based thumbnails by playback_id
      const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`;

      // Locate the translation either by upload_id or asset id
      const rows = await db
        .select()
        .from(lessonTranslations)
        .where(
          data.upload_id
            ? eq(lessonTranslations.muxUploadId, data.upload_id)
            : eq(lessonTranslations.muxAssetId, data.id),
        );

      if (rows.length === 0) {
        // Fallback to asset id
        const fallback = await db
          .select()
          .from(lessonTranslations)
          .where(eq(lessonTranslations.muxAssetId, data.id));
        if (fallback.length === 0) {
          console.warn("mux webhook: no matching translation for", data.id);
          break;
        }
        rows.push(...fallback);
      }

      for (const row of rows) {
        await db
          .update(lessonTranslations)
          .set({
            muxAssetId: data.id,
            muxPlaybackId: playbackId,
            durationSeconds: data.duration
              ? Math.round(data.duration)
              : row.durationSeconds,
            thumbnailUrl,
          })
          .where(eq(lessonTranslations.id, row.id));
      }
      break;
    }
    case "video.asset.errored": {
      const data = payload.data as AssetReadyData;
      console.error("Mux asset errored", data);
      break;
    }
    default:
      // Ignore unsubscribed events
      break;
  }

  return NextResponse.json({ ok: true });
}
