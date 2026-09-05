import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider, ShiftSlot } from "@/types";

const provider: Provider = {
    id: "attending-1",
    name: "Dr. Rivera",
    email: "rivera@hospital.org",
    role: "CLINICIAN",
    targetWeekDays: 4,
    targetWeekendDays: 1,
    targetWeekNights: 2,
    targetWeekendNights: 1,
    timeOffRequests: [],
    preferredDates: [],
    skills: ["NEURO_CRITICAL"],
    maxConsecutiveNights: 2,
    minDaysOffAfterNight: 1,
};
const slot = (id: string, providerId: string | null, serviceLocation: "G20" | "H22"): ShiftSlot => ({
    id,
    date: "2099-06-15",
    type: "DAY",
    providerId,
    isWeekendLayout: false,
    requiredSkill: "NEURO_CRITICAL",
    priority: "STANDARD",
    location: serviceLocation,
    locationGroup: "MAIN_CAMPUS_UNIT",
    servicePriority: "STANDARD",
    serviceLocation,
});

const store = {
    currentUser: provider,
    providers: [provider, { ...provider, id: "attending-2", name: "Dr. Chen" }],
    slots: [slot("mine", provider.id, "G20"), slot("team", "attending-2", "H22")],
    swapRequests: [],
    logout: vi.fn(),
    updateProvider: vi.fn(),
    createSwapRequest: vi.fn(),
    cancelSwapRequest: vi.fn(),
    showToast: vi.fn(),
};

vi.mock("@/store", () => ({
    useScheduleStore: (selector: (state: typeof store) => unknown) => selector(store),
}));

import { AttendingPortal } from "@/components/attending/AttendingPortal";

describe("AttendingPortal", () => {
    beforeEach(() => vi.clearAllMocks());

    it("switches mobile sections and opens the next shift team roster", async () => {
        render(<AttendingPortal />);

        await waitFor(() => expect(screen.getByRole("region", { name: "My month calendar" })).toBeVisible());
        fireEvent.click(screen.getByRole("button", { name: "My shifts" }));
        expect(screen.getByRole("region", { name: "Upcoming shifts" })).toBeVisible();
        expect(screen.getByRole("button", { name: "My shifts" })).toHaveAttribute("aria-current", "page");

        fireEvent.click(screen.getByRole("button", { name: "View team roster" }));
        await waitFor(() => expect(screen.getByRole("region", { name: "My month calendar" })).toBeVisible());
        await waitFor(() => expect(screen.getByRole("region", { name: /Roster for 2099-06-15/ })).toBeVisible());
        expect(screen.getByText("Dr. Chen")).toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Requests" }));
        expect(screen.getByRole("region", { name: "Time off" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Requests" })).toHaveAttribute("aria-current", "page");
    });
});
