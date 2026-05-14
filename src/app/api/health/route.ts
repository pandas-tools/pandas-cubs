import { NextResponse } from "next/server";
import { pg } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [row] = await pg`select 1 as up`;
    return NextResponse.json({
      ok: true,
      db: row?.up === 1 ? "ok" : "unknown",
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
