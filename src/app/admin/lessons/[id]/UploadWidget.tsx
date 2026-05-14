"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadWidget({
  lessonId,
  translationId,
}: {
  lessonId: string;
  translationId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    setProgress(0);
    try {
      // 1. Request a Mux direct upload URL for this lesson/translation
      const urlRes = await fetch("/api/admin/mux/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, translationId, language: "en" }),
      });
      if (!urlRes.ok) {
        const detail = await urlRes.text();
        throw new Error(`Upload URL failed: ${detail}`);
      }
      const { url } = (await urlRes.json()) as { url: string };

      // 2. PUT the file directly to Mux
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Mux upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      setProgress(100);
      // The Mux webhook will populate playback_id once processing completes.
      // Until then, the upload_id is on the translation row (set server-side).
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-2">
        Upload video
      </label>
      <input
        type="file"
        accept="video/*"
        onChange={onPick}
        disabled={pending}
        className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 disabled:opacity-50"
      />
      {progress !== null && (
        <p className="mt-2 text-sm text-zinc-600">
          {progress < 100 ? `Uploading… ${progress}%` : "Uploaded — Mux is processing."}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
