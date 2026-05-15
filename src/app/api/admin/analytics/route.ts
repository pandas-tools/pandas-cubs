import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const data = await getClientAnalytics();
  return NextResponse.json({ clients: data });
}
