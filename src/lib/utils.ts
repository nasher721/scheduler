import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Get initials from a provider name.
 * "Dr. Sarah Chen" → "SC", "Marcus Williams" → "MW", single → "Ma"
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words
    .filter((w) => !/^(dr|md|do|phd)$/i.test(w)) // skip titles
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();
}

/**
 * Deterministic avatar color based on name hash.
 * Returns a Tailwind bg class name.
 */
const AVATAR_PALETTE = [
  "bg-blue-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * Deterministic text color for avatar (always white/light for contrast).
 */
export function getAvatarTextColor(): string {
  return "text-white";
}

/**
 * Mask placeholder UUID emails so they don't expose test data.
 * "aewfwef-uuid@example.com" → "••••••@example.com"
 * Real emails are returned unchanged.
 */
export function maskPlaceholderEmail(email: string | null | undefined): string {
  if (!email) return "";
  // Detect UUID-pattern + common placeholder prefixes
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  if (uuidPattern.test(email) || email.includes("-uuid@") || email.startsWith("test") || email.includes("xxxx")) {
    const domain = email.substring(email.indexOf("@"));
    return "••••••" + domain;
  }
  return email;
}
