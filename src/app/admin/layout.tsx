import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { signOutAction } from "../actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/browse");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold">
              Cubs · Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <Link href="/admin" className="hover:text-zinc-900">
                Overview
              </Link>
              <Link href="/admin/lessons" className="hover:text-zinc-900">
                Lessons
              </Link>
              <Link href="/admin/clients" className="hover:text-zinc-900">
                Clients
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-500">{session.user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
