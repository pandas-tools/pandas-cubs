import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEmailAllowed } from "@/lib/domain";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const result = await checkEmailAllowed(parsed.data.email);
  if (result.kind === "rejected") {
    // Generic message — don't leak which clients we serve
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
