"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLanguage, removeLanguage } from "../actions";

const LANGS = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
];

export default function LanguagesEditor({
  clientId,
  languages,
}: {
  clientId: string;
  languages: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const enabled = new Set(languages);

  function toggle(code: string) {
    startTransition(async () => {
      if (enabled.has(code)) {
        await removeLanguage({ clientId, language: code });
      } else {
        await addLanguage({ clientId, language: code });
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {LANGS.map((l) => {
          const isOn = enabled.has(l.code);
          return (
            <li
              key={l.code}
              className="flex items-center justify-between rounded px-3 py-2 text-sm hover:bg-zinc-50"
            >
              <span>
                <span className="font-mono text-xs text-zinc-500 mr-2">
                  {l.code}
                </span>
                {l.label}
              </span>
              <button
                type="button"
                onClick={() => toggle(l.code)}
                disabled={pending}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  isOn
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-zinc-300 text-zinc-700 hover:border-zinc-500"
                } disabled:opacity-50`}
              >
                {isOn ? "Enabled ✓" : "Enable"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
