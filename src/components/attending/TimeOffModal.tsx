import { useMemo, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { TimeOffType } from "@/types";
import { expandDateRange } from "./attendingUtils";

const TIME_OFF_LABELS: Record<TimeOffType, string> = {
    PTO: "Vacation (PTO)",
    CME: "Conference / CME",
    SICK: "Sick leave",
    UNAVAILABLE: "Unavailable",
};

interface TimeOffModalProps {
    onClose: () => void;
    onSubmit: (dates: string[], type: TimeOffType, notes: string) => void;
}

/** Modal for an attending to block out a date range as time off. */
export function TimeOffModal({ onClose, onSubmit }: TimeOffModalProps) {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    const [startDate, setStartDate] = useState(todayISO);
    const [endDate, setEndDate] = useState(todayISO);
    const [type, setType] = useState<TimeOffType>("PTO");
    const [notes, setNotes] = useState("");

    const dates = useMemo(() => expandDateRange(startDate, endDate), [startDate, endDate]);
    const rangeInvalid = Boolean(startDate && endDate && endDate < startDate);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (dates.length === 0) return;
        onSubmit(dates, type, notes.trim());
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Request time off"
        >
            <motion.form
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
            >
                <div className="mb-5 flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Request time off</h3>
                        <p className="mt-0.5 text-sm text-foreground-muted">
                            Blocked dates are excluded from auto-scheduling and sent to the scheduler for review.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-secondary/60 hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-foreground">Type</span>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as TimeOffType)}
                            className="input-base rounded-lg py-2"
                        >
                            {(Object.keys(TIME_OFF_LABELS) as TimeOffType[]).map((key) => (
                                <option key={key} value={key}>
                                    {TIME_OFF_LABELS[key]}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-foreground">First day</span>
                            <input
                                type="date"
                                required
                                value={startDate}
                                min={todayISO}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (endDate < e.target.value) setEndDate(e.target.value);
                                }}
                                className="input-base rounded-lg py-2"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-foreground">Last day</span>
                            <input
                                type="date"
                                required
                                value={endDate}
                                min={startDate || todayISO}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="input-base rounded-lg py-2"
                            />
                        </label>
                    </div>

                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-foreground">Notes (optional)</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g. Presenting at NCS annual meeting"
                            className="input-base resize-none rounded-lg py-2"
                        />
                    </label>

                    <p className="text-xs text-foreground-muted">
                        {rangeInvalid
                            ? "Last day must be on or after the first day."
                            : dates.length > 0
                                ? `${dates.length} day${dates.length === 1 ? "" : "s"} will be blocked.`
                                : "Pick a date range to continue."}
                    </p>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={dates.length === 0}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        Submit request
                    </button>
                </div>
            </motion.form>
        </motion.div>
    );
}
