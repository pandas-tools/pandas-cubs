"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Match exactly for /admin (so it doesn't always look active),
  // prefix-match for sub-routes.
  const isActive =
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 transition-colors ${
        isActive
          ? "bg-zinc-100 text-zinc-900 font-medium"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      {children}
    </Link>
  );
}
