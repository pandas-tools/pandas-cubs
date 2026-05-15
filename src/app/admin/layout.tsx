import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { signOutAction } from "../actions";
import AdminNavLink from "./AdminNavLink";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/browse");

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      <aside className="hidden sm:flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="px-5 py-5 border-b border-zinc-200">
          <Link href="/admin" className="font-semibold text-zinc-900">
            Dojo · Admin
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <AdminNavLink href="/admin">Overview</AdminNavLink>
          <AdminNavLink href="/admin/lessons">Lessons</AdminNavLink>
          <AdminNavLink href="/admin/clients">Clients</AdminNavLink>
        </nav>
        <div className="border-t border-zinc-200 px-5 py-4 space-y-2">
          <p className="text-xs text-zinc-500 truncate" title={session.user.email ?? ""}>
            {session.user.email}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar (sidebar collapses on narrow viewports) */}
      <header className="sm:hidden flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 w-full">
        <Link href="/admin" className="font-semibold text-zinc-900 text-sm">
          Dojo · Admin
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-xs text-zinc-600 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto sm:mx-0 w-full">
        {children}
      </main>
    </div>
  );
}
