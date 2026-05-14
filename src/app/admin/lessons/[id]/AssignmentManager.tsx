"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignToClient, unassignFromClient } from "../actions";

type ClientRow = { id: string; name: string };

export default function AssignmentManager({
  lessonId,
  clients,
  assignedIds,
}: {
  lessonId: string;
  clients: ClientRow[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const assigned = new Set(assignedIds);

  function toggle(clientId: string) {
    startTransition(async () => {
      if (assigned.has(clientId)) {
        await unassignFromClient(lessonId, clientId);
      } else {
        await assignToClient(lessonId, clientId);
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      {clients.length === 0 ? (
        <p className="text-sm text-zinc-500">No clients configured.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => {
            const isAssigned = assigned.has(c.id);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{c.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  disabled={pending}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    isAssigned
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-zinc-300 text-zinc-700 hover:border-zinc-500"
                  } disabled:opacity-50`}
                >
                  {isAssigned ? "Assigned ✓" : "Assign"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
