"use server";

import { signIn } from "@/lib/auth";

export async function signInWithEmail(email: string) {
  await signIn("resend", { email, redirectTo: "/" });
}
