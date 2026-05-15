// Temporary debug endpoint. Returns the auth() result as seen by Node-runtime
// API routes (via lib/auth.ts) AND simulates middleware decoding by importing
// the slim config. To be removed once the middleware auth bug is sorted.
import { NextResponse } from "next/server";
import { auth as fullAuth } from "@/lib/auth";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth: slimAuth } = NextAuth(authConfig);

export async function GET() {
  // Guard: require a header secret so we don't expose session contents.
  // For now, no header guard — purely for the live E2E test, then removed.
  const full = await fullAuth();
  const slim = await slimAuth();
  return NextResponse.json({ full, slim });
}
