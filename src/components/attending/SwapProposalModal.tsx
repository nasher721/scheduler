import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { ArrowLeftRight, X } from "lucide-react";
import type { Provider, ShiftSlot } from "@/types";
import { getUpcomingShifts } from "./attendingUtils";

export interface SwapProposalPayload {
    fromSlot: ShiftSlot;
    targetProviderId: string;
    targetSlot: ShiftSlot;
    notes: string;
}

interface SwapProposalModalProps {
    myShifts: ShiftSlot[];
    colleagues: Provider[];
    slots: ShiftSlot[];
    /** Preselected shift when opened from a specific shift row */
    initialSlotId?: string | null;
    onClose: () => void;
    onSubmit: (payload: SwapProposalPayload) => void;
}

const describeShift = (slot: ShiftSlot) =>
    `${format(parseISO(slot.date), "EEE MMM d")} · ${slot.type} · ${slot.serviceLocation}`;

/** Modal for an attending to propose a shift swap with a colleague. */
export function SwapProposalModal({
    myShifts,
    colleagues,
    slots,
    initialSlotId,
    onClose,
    onSubmit,
}: SwapProposalModalProps) {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    const [mySlotId, setMySlotId] = useState<string>(() =>
        initialSlotId && myShifts.some((s) => s.id === initialSlotId) ? initialSlotId : myShifts[0]?.id ?? "",
    );
    const [targetProviderId, setTargetProviderId] = useState<string>("");
    const [targetSlotId, setTargetSlotId] = useState<string>("");
    const [notes, setNotes] = useState("");

    const targetShifts = useMemo(
        () => (targetProviderId ? getUpcomingShifts(slots, targetProviderId, todayISO) : []),
        [slots, targetProviderId, todayISO],
    );

    const fromSlot = myShifts.find((s) => s.id === mySlotId) ?? null;
    const targetSlot = targetShifts.find((s) => s.id === targetSlotId) ?? null;
    const canSubmit = Boolean(fromSlot && targetProviderId && targetSlot);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromSlot || !targetSlot || !targetProviderId) return;
        onSubmit({ fromSlot, targetProviderId, targetSlot, notes: notes.trim() });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="swap-proposal-title"
            aria-describedby="swap-proposal-description"
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
                        <h3 id="swap-proposal-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                            <ArrowLeftRight className="h-4 w-4 text-primary" />
                            Propose a swap
                        </h3>
                        <p id="swap-proposal-description" className="mt-0.5 text-sm text-foreground-muted">
                            The scheduler reviews and applies approved swaps automatically.
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

                {myShifts.length === 0 ? (
                    <p className="py-4 text-sm text-foreground-muted">
                        You have no upcoming shifts to offer in a swap.
                    </p>
                ) : (
                    <div className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-foreground">Your shift to give away</span>
                            <select value={mySlotId} onChange={(e) => setMySlotId(e.target.value)} className="input-base rounded-lg py-2">
                                {myShifts.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                        {describeShift(slot)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-foreground">Swap with</span>
                            <select
                                value={targetProviderId}
                                onChange={(e) => {
                                    setTargetProviderId(e.target.value);
                                    setTargetSlotId("");
                                }}
                                className="input-base rounded-lg py-2"
                            >
                                <option value="">Select a colleague…</option>
                                {colleagues.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {targetProviderId && (
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="font-medium text-foreground">Their shift you would take</span>
                                {targetShifts.length === 0 ? (
                                    <p className="rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted">
                                        This colleague has no upcoming shifts to trade.
                                    </p>
                                ) : (
                                    <select
                                        value={targetSlotId}
                                        onChange={(e) => setTargetSlotId(e.target.value)}
                                        className="input-base rounded-lg py-2"
                                    >
                                        <option value="">Select their shift…</option>
                                        {targetShifts.map((slot) => (
                                            <option key={slot.id} value={slot.id}>
                                                {describeShift(slot)}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </label>
                        )}

                        <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-foreground">Notes (optional)</span>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Why you're proposing this swap"
                                className="input-base resize-none rounded-lg py-2"
                            />
                        </label>
                    </div>
                )}

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
                        disabled={!canSubmit}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        Send proposal
                    </button>
                </div>
            </motion.form>
        </motion.div>
    );
}
