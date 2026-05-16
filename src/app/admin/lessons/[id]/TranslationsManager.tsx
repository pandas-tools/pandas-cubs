"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addTranslation,
  updateTranslation,
  deleteTranslation,
  copyMuxFromEnglish,
  clearMux,
} from "./translations-actions";

type Translation = {
  id: string;
  language: string;
  title: string;
  description: string | null;
  notesMarkdown: string | null;
  muxPlaybackId: string | null;
  muxUploadId: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  nl: "Nederlands",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
};

const ADDABLE = ["fr", "nl", "de", "es", "it", "pt"];

export default function TranslationsManager({
  lessonId,
  translations,
}: {
  lessonId: string;
  translations: Translation[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Add-translation form state
  const [newLang, setNewLang] = useState<string>(
    ADDABLE.find((l) => !translations.some((t) => t.language === l)) ?? "fr",
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const englishTranslation = translations.find((t) => t.language === "en");
  const englishReady = !!englishTranslation?.muxPlaybackId;
  const availableLangs = ADDABLE.filter(
    (l) => !translations.some((t) => t.language === l),
  );

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addTranslation({
        lessonId,
        language: newLang,
        title: newTitle,
        description: newDesc || undefined,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setNewTitle("");
      setNewDesc("");
      router.refresh();
    });
  }

  // Sort: English first, then by language code
  const sorted = [...translations].sort((a, b) => {
    if (a.language === "en") return -1;
    if (b.language === "en") return 1;
    return a.language.localeCompare(b.language);
  });

  return (
    <div className="space-y-4">
      {sorted.map((t) => (
        <TranslationRow
          key={t.id}
          lessonId={lessonId}
          translation={t}
          englishReady={englishReady}
          startTransition={startTransition}
          pending={pending}
          setError={setError}
        />
      ))}

      {availableLangs.length > 0 && (
        <form
          onSubmit={onAdd}
          className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-zinc-700">Add translation</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Language
              </label>
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {availableLangs.map((l) => (
                  <option key={l} value={l}>
                    {LANG_LABELS[l]} ({l})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Title
              </label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={`Welcome to Pandas Vision AI (in ${LANG_LABELS[newLang] ?? newLang})`}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Description (optional)
              </label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || !newTitle}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
            >
              {pending ? "Adding…" : "Add translation"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function TranslationRow({
  lessonId,
  translation: t,
  englishReady,
  startTransition,
  pending,
  setError,
}: {
  lessonId: string;
  translation: Translation;
  englishReady: boolean;
  startTransition: (fn: () => void) => void;
  pending: boolean;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description ?? "");
  const [notes, setNotes] = useState(t.notesMarkdown ?? "");
  const isEnglish = t.language === "en";

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateTranslation({
        translationId: t.id,
        lessonId,
        title,
        description: description.trim() ? description : null,
        notesMarkdown: notes.trim() ? notes : null,
      });
      if (res?.error) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete the ${LANG_LABELS[t.language] ?? t.language} translation?`))
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTranslation({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onCopyEn() {
    setError(null);
    startTransition(async () => {
      const res = await copyMuxFromEnglish({
        translationId: t.id,
        lessonId,
      });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onClearVideo() {
    if (!confirm("Clear the video for this translation? You'll need to re-upload or copy from English."))
      return;
    setError(null);
    startTransition(async () => {
      const res = await clearMux({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono uppercase text-zinc-700">
              {t.language}
            </span>
            <span className="text-xs text-zinc-500">
              {LANG_LABELS[t.language] ?? t.language}
            </span>
            {isEnglish && (
              <span className="text-xs text-zinc-500">
                · system-wide fallback
              </span>
            )}
          </div>
          {!editing ? (
            <>
              <h3 className="font-medium text-zinc-900">{t.title}</h3>
              {t.description && (
                <p className="text-sm text-zinc-600 mt-1">{t.description}</p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (markdown, optional)"
                rows={4}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-1 items-end">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-zinc-700 hover:underline"
              >
                Edit
              </button>
              {!isEnglish && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={pending}
                  className="text-xs text-red-700 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(t.title);
                  setDescription(t.description ?? "");
                  setNotes(t.notesMarkdown ?? "");
                }}
                className="text-xs text-zinc-600 hover:underline"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm">
        {t.muxPlaybackId ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-emerald-700 font-medium">✓ Ready</span>
              <code className="font-mono text-xs text-zinc-600 truncate max-w-xs">
                {t.muxPlaybackId}
              </code>
              {t.durationSeconds !== null && (
                <span className="text-xs text-zinc-500">
                  {t.durationSeconds < 60
                    ? `${t.durationSeconds}s`
                    : `${Math.round(t.durationSeconds / 60)} min`}
                </span>
              )}
              <button
                type="button"
                onClick={onClearVideo}
                disabled={pending}
                className="ml-auto text-xs text-red-700 hover:underline disabled:opacity-50"
              >
                Clear video
              </button>
            </div>
            {t.thumbnailUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={t.thumbnailUrl}
                alt="Thumbnail"
                className="max-w-xs rounded-md border border-zinc-200"
              />
            )}
          </div>
        ) : t.muxUploadId ? (
          <p className="text-amber-700">
            ⏳ Upload in progress / Mux is processing. Refresh in a minute.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-zinc-600 text-xs">No video uploaded yet.</p>
            <div className="flex gap-2 flex-wrap">
              <UploadButton
                lessonId={lessonId}
                translationId={t.id}
                language={t.language}
              />
              {!isEnglish && englishReady && (
                <button
                  type="button"
                  onClick={onCopyEn}
                  disabled={pending}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
                >
                  Share English video
                </button>
              )}
            </div>
            {!isEnglish && !englishReady && (
              <p className="text-xs text-zinc-500">
                Upload the English video first if you want to share it with
                this translation.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadButton({
  lessonId,
  translationId,
  language,
}: {
  lessonId: string;
  translationId: string;
  language: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    setProgress(0);
    try {
      const urlRes = await fetch("/api/admin/mux/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, translationId, language }),
      });
      if (!urlRes.ok) {
        throw new Error(`Upload URL failed: ${await urlRes.text()}`);
      }
      const { url } = (await urlRes.json()) as { url: string };
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
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });
      setProgress(100);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="inline-block rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors cursor-pointer">
        {pending
          ? progress !== null && progress < 100
            ? `Uploading ${progress}%`
            : "Processing…"
          : "Upload video"}
        <input
          type="file"
          accept="video/*"
          onChange={onPick}
          disabled={pending}
          className="hidden"
        />
      </label>
      {error && (
        <p className="mt-1 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
