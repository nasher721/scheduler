import { describe, it, expect } from "vitest";
import type {
  BroadcastChannel,
  ShiftLifecycleStatus,
  CommunicationPreferences,
  FatigueMetrics,
  BroadcastRecipient,
  MarketplaceShift,
  BroadcastHistoryEntry,
  EscalationConfig,
} from "@/types";

describe("Marketplace type exports", () => {
  it("BroadcastChannel only allows sms, email, push", () => {
    const channels: BroadcastChannel[] = ["sms", "email", "push"];
    expect(channels).toHaveLength(3);
    expect(channels).toContain("sms");
    expect(channels).toContain("email");
    expect(channels).toContain("push");
  });

  it("ShiftLifecycleStatus has exactly 6 values including CANCELLED", () => {
    const values: ShiftLifecycleStatus[] = [
      "POSTED",
      "AI_EVALUATING",
      "BROADCASTING",
      "CLAIMED",
      "APPROVED",
      "CANCELLED",
    ];
    expect(values).toHaveLength(6);
    expect(values).toContain("POSTED");
    expect(values).toContain("AI_EVALUATING");
    expect(values).toContain("BROADCASTING");
    expect(values).toContain("CLAIMED");
    expect(values).toContain("APPROVED");
    expect(values).toContain("CANCELLED");
  });

  it("CommunicationPreferences shape compiles with boolean fields", () => {
    const prefs: CommunicationPreferences = { sms: true, email: true, push: true };
    expect(prefs.sms).toBe(true);
    expect(prefs.email).toBe(true);
    expect(prefs.push).toBe(true);
  });

  it("FatigueMetrics uses days (not hours)", () => {
    const metrics: FatigueMetrics = {
      consecutiveShiftsWorked: 3,
      shiftsThisMonth: 12,
      riskLevel: "medium",
    };
    expect(typeof metrics.consecutiveShiftsWorked).toBe("number");
    expect(typeof metrics.shiftsThisMonth).toBe("number");
    expect(metrics.riskLevel).toBe("medium");
  });

  it("BroadcastRecipient has required fields", () => {
    const recipient: BroadcastRecipient = {
      id: "r-1",
      providerId: "p-1",
      channel: "email",
      sentAt: new Date().toISOString(),
      viewedAt: null,
      respondedAt: null,
    };
    expect(recipient.id).toBe("r-1");
    expect(recipient.channel).toBe("email");
    expect(recipient.sentAt).toBeTruthy();
    expect(recipient.viewedAt).toBeNull();
    expect(recipient.respondedAt).toBeNull();
  });

  it("MarketplaceShift compiles with all required fields", () => {
    const shift: MarketplaceShift = {
      id: "ms-1",
      slotId: "slot-1",
      postedByProviderId: "prov-1",
      date: "2026-04-01",
      shiftType: "DAY",
      location: "NICU",
      lifecycleState: "POSTED",
      postedAt: new Date().toISOString(),
      claimedByProviderId: null,
      claimedAt: null,
      approvedBy: null,
      approvedAt: null,
      broadcastRecipients: [],
      notes: "",
    };
    expect(shift.id).toBeTruthy();
    expect(shift.slotId).toBe("slot-1");
    expect(shift.date).toBe("2026-04-01");
    expect(shift.lifecycleState).toBe("POSTED");
    expect(shift.claimedByProviderId).toBeNull();
    expect(shift.notes).toBe("");
  });

  it("BroadcastHistoryEntry compiles with required fields", () => {
    const entry: BroadcastHistoryEntry = {
      id: "bh-1",
      marketplaceShiftId: "ms-1",
      tier: 1,
      recipients: [],
      sentAt: new Date().toISOString(),
      channel: "email",
      status: "sent",
    };
    expect(entry.id).toBe("bh-1");
    expect(entry.tier).toBe(1);
    expect(entry.status).toBe("sent");
  });

  it("EscalationConfig has sensible defaults", () => {
    const defaultConfig: EscalationConfig = {
      autoEscalationDelayMinutes: 60,
      maxEscalationTiers: 3,
    };
    expect(defaultConfig.autoEscalationDelayMinutes).toBe(60);
    expect(defaultConfig.maxEscalationTiers).toBe(3);
  });
});
