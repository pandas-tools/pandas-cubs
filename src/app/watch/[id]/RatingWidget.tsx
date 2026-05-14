"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RatingWidget({
  lessonId,
  initialRating,
}: {
  lessonId: string;
  initialRating: number | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [submitted, setSubmitted] = useState(initialRating !== null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit(value: number) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/lessons/${lessonId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      if (!res.ok) {
        setError("Couldn't save your rating. Try again.");
        return;
      }
      setRating(value);
      setSubmitted(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-zinc-800 p-4">
      <p className="text-sm text-zinc-200 mb-3">
        {submitted ? "Thanks for your rating." : "How useful was this lesson?"}
      </p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onClick={() => submit(n)}
            className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
              rating !== null && n <= rating
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            } disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
