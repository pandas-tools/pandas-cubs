import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientDetailAnalytics } from "@/lib/analytics-detail";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ clientId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { clientId } = await ctx.params;
  const data = await getClientDetailAnalytics(clientId);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
