/**
 * Conflict types and default messages.
 * Detection logic stays in code; edit here to change user-facing messages or add types.
 */

export const CONFLICT_TYPES = {
  unassigned_slot: {
    severity: "high",
    message: "Slot has no assigned provider.",
  },
  missing_provider: {
    severity: "high",
    message: "Assigned provider does not exist.",
  },
  skill_mismatch: {
    severity: "high",
    message: "Provider missing required skill for slot.",
  },
  time_off_violation: {
    severity: "high",
    message: "Provider is assigned on an approved time-off date.",
  },
  expired_credential: {
    severity: "high",
    message: "Provider has an expired credential for this date.",
  },
  double_booked: {
    severity: "medium",
    message: "Provider is assigned more than once on this date.",
  },
  max_shifts_per_week_exceeded: {
    severity: "medium",
    message: "Provider exceeds configured maximum shifts for this week.",
  },
};

/**
 * Get message and severity for a conflict type. Falls back to type as message if not in config.
 */
export function getConflictMessage(type, overrides = {}) {
  const entry = CONFLICT_TYPES[type];
  const severity = overrides.severity ?? entry?.severity ?? "medium";
  const message = overrides.message ?? entry?.message ?? String(type);
  return { severity, message };
}
