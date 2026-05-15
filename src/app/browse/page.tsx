import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import { signOutAction } from "../actions";

export const metadata = { title: "Lessons · Dojo" };
export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (!session.user.onboardingCompleted) redirect("/onboarding");
  if (!session.user.clientId) redirect("/login");

  const sdb = scopedDb({
    id: session.user.id,
    clientId: session.user.clientId,
    role: "employee",
  });

  const [lessons, completions, client] = await Promise.all([
    sdb.lessons.list(),
    sdb.completions.forUser(),
    sdb.client.get(),
  ]);

  const completedIds = new Set(completions.map((c) => c.lessonId));

  // Hydrate each lesson with a translation in the user's preferred language
  const cards = await Promise.all(
    lessons.map(async (lesson) => {
      const translation = await sdb.translations.forLesson(
        lesson.id,
        session.user.preferredLanguage,
      );
      return {
        id: lesson.id,
        title: translation?.title ?? lesson.internalName,
        description: translation?.description ?? null,
        thumbnail: translation?.thumbnailUrl ?? null,
        durationSeconds: translation?.durationSeconds ?? null,
        completed: completedIds.has(lesson.id),
        language: translation?.language ?? null,
      };
    }),
  );

  const ready = cards.filter((c) => c.thumbnail !== null);
  const processing = cards.filter((c) => c.thumbnail === null);

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Dojo</h1>
            <p className="text-xs text-zinc-500">
              {client?.name ?? "Your client"} · {session.user.email}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-xl font-semibold mb-2">Training lessons</h2>
        <p className="text-sm text-zinc-600 mb-8">
          {ready.length === 0
            ? "No lessons available yet. Check back soon."
            : `${ready.length} lesson${ready.length === 1 ? "" : "s"} ready · ${completedIds.size} completed`}
        </p>

        {ready.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((card) => (
              <Link
                key={card.id}
                href={`/watch/${card.id}`}
                className="group block overflow-hidden rounded-md border border-zinc-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-zinc-100 relative">
                  {card.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.thumbnail}
                      alt={card.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                      Processing…
                    </div>
                  )}
                  {card.completed && (
                    <div className="absolute top-2 right-2 rounded-full bg-emerald-600 text-white text-xs px-2 py-1">
                      ✓ Done
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-zinc-900 group-hover:text-zinc-700">
                    {card.title}
                  </h3>
                  {card.description && (
                    <p className="mt-1 text-sm text-zinc-600 line-clamp-2">
                      {card.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    {card.durationSeconds && (
                      <span>
                        {card.durationSeconds < 60
                          ? `${card.durationSeconds}s`
                          : `${Math.ceil(card.durationSeconds / 60)} min`}
                      </span>
                    )}
                    {card.language &&
                      card.language !== session.user.preferredLanguage && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 uppercase">
                          {card.language}
                        </span>
                      )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {processing.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-medium text-zinc-700 mb-3">
              Coming soon ({processing.length})
            </h3>
            <ul className="space-y-2">
              {processing.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500"
                >
                  {c.title} — video still processing
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
