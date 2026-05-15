import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Dojo" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 bg-zinc-50">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-2">Dojo</h1>
        <p className="text-zinc-600 mb-8 text-sm">
          Training portal for Pandas Vision AI. Enter your work email to receive
          a magic link.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
