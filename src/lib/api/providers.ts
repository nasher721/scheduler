/**
 * Providers API
 * Provider registration and management
 */

import { requestJson } from "./client";
import { type Provider } from "../../types";

export interface RegisterProviderResponse {
  ok: boolean;
  provider: Provider;
  updatedAt: string;
}

/**
 * Register a provider.
 *
 * This goes through the API server rather than writing to Supabase from the
 * browser. Two reasons:
 *
 *  1. RLS. `providers` is insert-restricted to schedulers/admins or to a row
 *     whose `profile_id` is the caller's own `auth.uid()`. A browser client
 *     adding a *different* person is neither, so the insert is rejected.
 *  2. Account linking. The previous implementation called `supabase.auth.signUp`
 *     with a generated throwaway password, which created an account nobody
 *     could sign in to and — when email confirmation is disabled — replaced the
 *     signed-in scheduler's session with the new user's.
 *
 * The schema handles linking instead: `handle_new_user` attaches a provider row
 * to an account on sign-up by matching the email address. So a provider is
 * created here first, and the person claims it whenever they sign up.
 */
export async function registerProvider(
  provider: Omit<Provider, "id">,
): Promise<{ ok: boolean; provider: Provider }> {
  const email = provider.email?.trim();
  if (!email || !email.includes("@")) {
    throw new Error("Registration requires a valid provider email address.");
  }

  const response = await requestJson<RegisterProviderResponse>(
    "/api/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...provider, email: email.toLowerCase() }),
    },
    "Register provider",
  );

  return { ok: true, provider: response.provider };
}
