"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAllowedDomain, removeAllowedDomain } from "../actions";

export default function DomainsEditor({
  clientId,
  domains,
}: {
  clientId: string;
  domains: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addAllowedDomain({ clientId, domain: draft });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  }

  function onRemove(domain: string) {
    setError(null);
    startTransition(async () => {
      await removeAllowedDomain({ clientId, domain });
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
      <form onSubmit={onAdd} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="orange.be"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button
          type="submit"
          disabled={pending || !draft}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
        >
          {pending ? "…" : "Add"}
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {domains.length === 0 ? (
        <p className="text-sm text-zinc-500">No domains yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {domains.map((d) => (
            <li
              key={d}
              className="flex items-center gap-2 rounded bg-zinc-100 pl-2 pr-1 py-1 text-sm font-mono text-zinc-700"
            >
              {d}
              <button
                type="button"
                onClick={() => onRemove(d)}
                disabled={pending}
                aria-label={`Remove ${d}`}
                className="rounded text-zinc-500 hover:bg-zinc-200 hover:text-red-700 px-1 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
