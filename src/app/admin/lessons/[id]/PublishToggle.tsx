"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglePublish } from "../actions";

export default function PublishToggle({
  lessonId,
  isPublished,
}: {
  lessonId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function flip() {
    startTransition(async () => {
      await togglePublish(lessonId, !isPublished);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isPublished
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
      } disabled:opacity-50`}
    >
      {isPublished ? "Published" : "Draft — publish"}
    </button>
  );
}
