import Mux from "@mux/mux-node";
import crypto from "node:crypto";

type MuxLanguageCode =
  | "en"
  | "es"
  | "it"
  | "pt"
  | "de"
  | "fr"
  | "pl"
  | "ru"
  | "nl"
  | "ca"
  | "tr"
  | "sv"
  | "uk"
  | "no"
  | "fi"
  | "sk"
  | "el"
  | "cs"
  | "hr"
  | "da"
  | "ro"
  | "bg";

declare global {
  // eslint-disable-next-line no-var
  var __dojo_mux: Mux | undefined;
}

function getMux(): Mux {
  if (global.__dojo_mux) return global.__dojo_mux;
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID / MUX_TOKEN_SECRET not set");
  }
  const m = new Mux({ tokenId, tokenSecret });
  if (process.env.NODE_ENV !== "production") global.__dojo_mux = m;
  return m;
}

/**
 * Verify a Mux webhook signature.
 * Mux signs requests with HMAC-SHA256 over `${timestamp}.${rawBody}`.
 * Header: `mux-signature: t=<unix>,v1=<hex>`
 */
export function verifyMuxSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
): boolean {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MUX_WEBHOOK_SECRET not set — refusing webhook");
    return false;
  }
  if (!signatureHeader) return false;

  // Robust header parsing — split on the FIRST `=` so signature values
  // that contain `=` (e.g. base64 padding) aren't truncated.
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const trimmed = part.trim();
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    parts[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;

  const ageSec = Math.abs(Date.now() / 1000 - tsNum);
  if (ageSec > toleranceSeconds) return false;

  // SHA-256 → 32 bytes / 64 hex chars. Reject malformed sigs explicitly
  // so timingSafeEqual never throws on length mismatch.
  if (!/^[0-9a-fA-F]{64}$/.test(sig)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(sig, "hex"),
  );
}

/**
 * Create a direct upload URL for an admin to upload a video to.
 */
export async function createDirectUpload(opts: {
  corsOrigin: string;
  language?: MuxLanguageCode;
}) {
  const mux = getMux();
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
      input: [
        {
          generated_subtitles: [
            {
              language_code: (opts.language ?? "en") as MuxLanguageCode,
              name:
                (opts.language ?? "en") === "en" ? "English (CC)" : "Subtitles",
            },
          ],
        },
      ],
    },
  });
  return upload;
}
