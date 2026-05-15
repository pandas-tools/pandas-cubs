"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./actions";

export default function NewClientForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createClient({ name, slug: slug || undefined });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setName("");
      setSlug("");
      if (res?.clientId) router.push(`/admin/clients/${res.clientId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Orange Belgium"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Slug (optional — derived from name)
        </label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="orange-belgium"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="sm:col-span-1 flex items-end">
        <button
          type="submit"
          disabled={pending || !name}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
        >
          {pending ? "Creating…" : "Create client"}
        </button>
      </div>
      {error && (
        <p className="sm:col-span-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
