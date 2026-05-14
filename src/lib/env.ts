import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url(),
  AUTH_RESEND_KEY: z.string().min(1),
  AUTH_EMAIL_FROM: z.string().email(),
  MUX_TOKEN_ID: z.string().min(1),
  MUX_TOKEN_SECRET: z.string().min(1),
  MUX_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  ADMIN_ALLOWLIST: z.string().default(""),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

const BUILD_STUB: Env = {
  DATABASE_URL: "postgres://stub@localhost:5432/stub",
  AUTH_SECRET: "stub-build-secret-stub-build-secret",
  AUTH_URL: "http://localhost:3000",
  AUTH_RESEND_KEY: "re_stub",
  AUTH_EMAIL_FROM: "stub@example.com",
  MUX_TOKEN_ID: "stub",
  MUX_TOKEN_SECRET: "stub",
  MUX_WEBHOOK_SECRET: "stub",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  ADMIN_ALLOWLIST: "",
};

export function env(): Env {
  if (cached) return cached;
  // During `next build`, Railway reference variables (like DATABASE_URL)
  // may not be resolved. Return a stub so module-top calls don't blow up;
  // real validation happens at runtime on first env() in a handler.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return BUILD_STUB;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment variables failed validation. See logs.");
  }
  cached = parsed.data;
  return cached;
}

export function adminAllowlist(): string[] {
  return env()
    .ADMIN_ALLOWLIST.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
