"use client";

import { useState, useTransition } from "react";
import { deleteClient } from "../actions";

export default function DeleteClientButton({
  clientId,
  clientName,
  stats,
}: {
  clientId: string;
  clientName: string;
  stats: { stores: number; employees: number; lessons: number };
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const hasData = stats.stores + stats.employees + stats.lessons > 0;
  const expected = clientName;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
      >
        Delete client…
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 space-y-3">
      <p className="text-sm text-red-900">
        <strong>Deleting {clientName}</strong> will also cascade-delete:
      </p>
      <ul className="list-disc list-inside text-sm text-red-800">
        <li>{stats.stores} store{stats.stores === 1 ? "" : "s"}</li>
        <li>
          {stats.employees} employee{stats.employees === 1 ? "" : "s"} (and
          all their completions + ratings)
        </li>
        <li>
          {stats.lessons} lesson assignment{stats.lessons === 1 ? "" : "s"}{" "}
          (the lessons themselves stay, just unassigned)
        </li>
      </ul>
      {hasData && (
        <div>
          <label className="block text-xs font-medium text-red-900 mb-1">
            Type <span className="font-mono">{expected}</span> to confirm:
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || (hasData && typed !== expected)}
          onClick={() =>
            startTransition(async () => {
              await deleteClient(clientId);
            })
          }
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:bg-red-300 transition-colors"
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          disabled={pending}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
