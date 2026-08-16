import type { Provider, ShiftSlot } from "@/types";

export interface DuplicateGroup {
  canonical: Provider;
  duplicates: Provider[];
  reason: "exact_normalized_match" | "typo_variation" | "parenthetical_variation" | "email_match";
}

// Canonical name normalization dictionary
export const CANONICAL_NAME_ALIASES: Record<string, string> = {
  barrron: "Barron",
  barron: "Barron",
  mitchel: "Mitchell",
  mitchell: "Mitchell",
  kletsel: "Kletsel",
  giampalmo: "Giampalmo",
  hassett: "Hassett",
  hasset: "Hassett",
  sabharwal: "Sabharwal",
  sabarwhal: "Sabharwal",
  villamizar: "Villamizar Rosales",
  "villamizar rosales": "Villamizar Rosales",
  rosales: "Villamizar Rosales",
  lynch: "Lynch",
  bates: "Bates",
  bolt: "Bolt",
  dani: "Dani",
  gomes: "Gomes",
  goswami: "Goswami",
  asher: "Asher",
};

/**
 * Strips notes/qualifiers (e.g. "(moonlighting)", "(NP)", "(Fellow)"), titles, and corrects known typos.
 */
export function cleanProviderName(rawName: string): string {
  if (!rawName) return "";

  // 1. Remove parenthetical qualifiers: "Kletsel (moonlighting)" -> "Kletsel"
  let cleaned = rawName.replace(/\s*\([^)]*\)/g, "").trim();

  // 2. Remove titles/suffixes like "Dr.", "MD", "DO", "NP"
  cleaned = cleaned.replace(/^(dr\.?|doctor)\s+/i, "");
  cleaned = cleaned.replace(/,\s*(md|do|np|pa|rn)\b/i, "");

  // 3. Remove multiple spaces and normalize
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  const lower = cleaned.toLowerCase();

  // 4. Direct dictionary mapping
  if (CANONICAL_NAME_ALIASES[lower]) {
    return CANONICAL_NAME_ALIASES[lower];
  }

  // 5. Word-by-word alias lookup for compound names (e.g. "Giampalmo and Mitchell")
  const words = cleaned.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((word) => {
        const wLower = word.toLowerCase();
        if (CANONICAL_NAME_ALIASES[wLower]) {
          return CANONICAL_NAME_ALIASES[wLower];
        }
        if (wLower === "and" || wLower === "&") return "and";
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  // 6. Title case formatting
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Detects duplicate or suspicious provider records in the roster.
 */
export function detectDuplicateProviders(providers: Provider[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < providers.length; i++) {
    const current = providers[i];
    if (processed.has(current.id)) continue;

    const duplicates: Provider[] = [];
    let matchReason: DuplicateGroup["reason"] = "exact_normalized_match";

    const cleanCurrent = cleanProviderName(current.name).toLowerCase();
    const currentEmail = current.email?.toLowerCase().trim();

    for (let j = i + 1; j < providers.length; j++) {
      const candidate = providers[j];
      if (processed.has(candidate.id)) continue;

      const cleanCandidate = cleanProviderName(candidate.name).toLowerCase();
      const candidateEmail = candidate.email?.toLowerCase().trim();

      // Check 1: Matching email
      if (currentEmail && candidateEmail && currentEmail === candidateEmail) {
        duplicates.push(candidate);
        matchReason = "email_match";
        processed.add(candidate.id);
        continue;
      }

      // Check 2: Exact normalized name match (e.g. "Kletsel (moonlighting)" vs "Kletsel")
      if (cleanCurrent === cleanCandidate) {
        duplicates.push(candidate);
        matchReason = current.name.includes("(") || candidate.name.includes("(")
          ? "parenthetical_variation"
          : "exact_normalized_match";
        processed.add(candidate.id);
        continue;
      }

      // Check 3: Typo variation (Levenshtein distance <= 2 for names > 4 chars)
      if (cleanCurrent.length >= 4 && cleanCandidate.length >= 4) {
        const distance = levenshteinDistance(cleanCurrent, cleanCandidate);
        if (distance <= 2) {
          duplicates.push(candidate);
          matchReason = "typo_variation";
          processed.add(candidate.id);
          continue;
        }
      }
    }

    if (duplicates.length > 0) {
      processed.add(current.id);
      // Choose the canonical provider as the one with more shifts/skills or standard name
      const allInGroup = [current, ...duplicates];
      const canonical = allInGroup.reduce((best, item) => {
        const itemScore = (item.skills?.length || 0) + (item.credentials?.length || 0) + (item.email ? 2 : 0) - (item.name.includes("(") ? 5 : 0);
        const bestScore = (best.skills?.length || 0) + (best.credentials?.length || 0) + (best.email ? 2 : 0) - (best.name.includes("(") ? 5 : 0);
        return itemScore > bestScore ? item : best;
      }, current);

      const actualDuplicates = allInGroup.filter((p) => p.id !== canonical.id);

      groups.push({
        canonical: {
          ...canonical,
          name: cleanProviderName(canonical.name),
        },
        duplicates: actualDuplicates,
        reason: matchReason,
      });
    }
  }

  return groups;
}

/**
 * Merges duplicate providers into their canonical records and reassigns all slots.
 */
export function mergeDuplicateProviders(
  providers: Provider[],
  slots: ShiftSlot[],
  mergeMap: Array<{ canonicalId: string; duplicateIds: string[] }>,
): {
  mergedProviders: Provider[];
  updatedSlots: ShiftSlot[];
  reassignedCount: number;
  mergedCount: number;
} {
  let mergedProviders = [...providers];
  let updatedSlots = [...slots];
  let reassignedCount = 0;

  mergeMap.forEach(({ canonicalId, duplicateIds }) => {
    const canonicalIndex = mergedProviders.findIndex((p) => p.id === canonicalId);
    if (canonicalIndex === -1) return;

    const canonical = { ...mergedProviders[canonicalIndex] };
    const duplicateSet = new Set(duplicateIds);
    const duplicates = mergedProviders.filter((p) => duplicateSet.has(p.id));

    // Combine skills, requests, credentials
    const combinedSkills = new Set([...(canonical.skills || [])]);
    const combinedTimeOff = [...(canonical.timeOffRequests || [])];
    const combinedPreferred = new Set([...(canonical.preferredDates || [])]);
    const combinedCredentials = [...(canonical.credentials || [])];

    duplicates.forEach((dup) => {
      dup.skills?.forEach((s) => combinedSkills.add(s));
      dup.preferredDates?.forEach((d) => combinedPreferred.add(d));
      if (dup.timeOffRequests) combinedTimeOff.push(...dup.timeOffRequests);
      if (dup.credentials) combinedCredentials.push(...dup.credentials);
    });

    canonical.skills = Array.from(combinedSkills);
    canonical.timeOffRequests = combinedTimeOff;
    canonical.preferredDates = Array.from(combinedPreferred);
    canonical.credentials = combinedCredentials;
    canonical.name = cleanProviderName(canonical.name);

    mergedProviders[canonicalIndex] = canonical;

    // Reassign slots
    updatedSlots = updatedSlots.map((slot) => {
      if (slot.providerId && duplicateSet.has(slot.providerId)) {
        reassignedCount++;
        return { ...slot, providerId: canonicalId };
      }
      return slot;
    });

    // Remove duplicates
    mergedProviders = mergedProviders.filter((p) => !duplicateSet.has(p.id));
  });

  return {
    mergedProviders,
    updatedSlots,
    reassignedCount,
    mergedCount: mergeMap.length,
  };
}
