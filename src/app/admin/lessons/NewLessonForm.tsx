"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLesson } from "./actions";

export default function NewLessonForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [internalName, setInternalName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createLesson({ internalName, title, description });
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.lessonId) {
        router.push(`/admin/lessons/${res.lessonId}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Internal name
        </label>
        <input
          required
          value={internalName}
          onChange={(e) => setInternalName(e.target.value)}
          placeholder="vision-ai-retail"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Title (EN)
        </label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vision AI for retail"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Description (EN, optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      {error && (
        <p className="sm:col-span-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          disabled={pending || !internalName || !title}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
        >
          {pending ? "Creating…" : "Create lesson"}
        </button>
      </div>
    </form>
  );
}
