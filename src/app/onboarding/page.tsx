import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: "Welcome · Dojo" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.onboardingCompleted) redirect("/browse");
  if (!session.user.clientId) redirect("/login");

  const list = await db.query.stores.findMany({
    where: eq(stores.clientId, session.user.clientId),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">Welcome to Dojo</h1>
        <p className="text-sm text-zinc-600 mb-6">
          A quick onboarding so we can tailor your training experience.
        </p>
        <OnboardingForm stores={list} />
      </div>
    </main>
  );
}
