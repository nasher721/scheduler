/**
 * Providers API
 * Provider registration and management
 */

import { supabase } from "../supabase";
import { type Provider } from "../../types";

function generateEphemeralPassword(): string {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  // Ensure common provider password complexity checks pass.
  return `Tmp-${randomPart}-Aa1!`;
}

export async function registerProvider(provider: Omit<Provider, "id">): Promise<{ ok: boolean; provider: Provider }> {
  try {
    const email = provider.email?.trim();
    if (!email || !email.includes("@")) {
      throw new Error("Registration requires a valid provider email address.");
    }

    const ephemeralPassword = generateEphemeralPassword();

    // 1. Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: ephemeralPassword,
      options: {
        data: {
          name: provider.name,
          role: provider.role,
        },
      },
    });

    if (authError) {
      console.error("Supabase Auth Error:", authError);
      throw new Error(`Auth Error: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error("Registration failed: No user returned from Supabase");
    }

    // 2. Insert provider details into the providers table
    const { data: providerData, error: providerError } = await supabase
      .from("providers")
      .insert({
        id: crypto.randomUUID(),
        profile_id: authData.user.id,
        name: provider.name,
        email: provider.email,
        role: provider.role,
        target_week_days: provider.targetWeekDays,
        target_weekend_days: provider.targetWeekendDays,
        target_week_nights: provider.targetWeekNights,
        target_weekend_nights: provider.targetWeekendNights,
        time_off_requests: provider.timeOffRequests,
        preferred_dates: provider.preferredDates,
        skills: provider.skills,
        max_consecutive_nights: provider.maxConsecutiveNights,
        min_days_off_after_night: provider.minDaysOffAfterNight,
        notes: provider.notes,
      })
      .select()
      .single();

    if (providerError) {
      console.error("Supabase Database Error:", providerError);
      throw new Error(`Database Error: ${providerError.message}`);
    }

    return { ok: true, provider: { ...provider, id: providerData.id } as Provider };
  } catch (err) {
    console.error("Full Registration Failure:", err);
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      throw new Error("Connection failed: Ensure Supabase URL is correct and you have an internet connection.");
    }
    throw err;
  }
}
