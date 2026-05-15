export const metadata = { title: "Check your email · Dojo" };

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 bg-zinc-50">
      <div className="w-full max-w-sm rounded-md border border-emerald-200 bg-emerald-50 p-6 text-sm">
        <h1 className="text-lg font-semibold text-emerald-900 mb-2">
          Check your inbox.
        </h1>
        <p className="text-emerald-800">
          We sent you a sign-in link. Click the link in the email to continue.
        </p>
      </div>
    </main>
  );
}
