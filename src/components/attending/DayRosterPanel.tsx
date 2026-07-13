import { format, parseISO } from "date-fns";
import { ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShiftColorClasses } from "@/lib/shiftColors";
import type { DayRosterEntry } from "./attendingUtils";

interface DayRosterPanelProps {
    dateISO: string;
    entries: DayRosterEntry[];
    currentProviderId: string;
    onClose: () => void;
}

/** "Who's on" roster for a single day, critical services first. */
export function DayRosterPanel({ dateISO, entries, currentProviderId, onClose }: DayRosterPanelProps) {
    const unfilled = entries.filter((e) => !e.slot.providerId).length;

    return (
        <section className="satin-panel p-4 sm:p-6" aria-label={`Roster for ${dateISO}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-foreground">
                        Who&apos;s on · {format(parseISO(dateISO), "EEEE, MMM d")}
                    </h3>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                        {entries.length} service{entries.length === 1 ? "" : "s"}
                        {unfilled > 0 ? ` · ${unfilled} unfilled` : " · fully staffed"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-secondary/60 hover:text-foreground"
                    aria-label="Close day roster"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {entries.length === 0 ? (
                <p className="py-4 text-center text-sm text-foreground-muted">No services scheduled on this day.</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {entries.map(({ slot, providerName }) => {
                        const isMine = slot.providerId === currentProviderId;
                        return (
                            <li
                                key={slot.id}
                                className={cn(
                                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                                    isMine ? "border-primary/40 bg-primary/5" : "border-border/60",
                                )}
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span
                                        className={cn(
                                            "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                            getShiftColorClasses(slot.type),
                                        )}
                                    >
                                        {slot.type}
                                    </span>
                                    <span className="truncate text-sm font-semibold text-foreground">{slot.serviceLocation}</span>
                                    {slot.servicePriority === "CRITICAL" && (
                                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-error" aria-label="Critical service" />
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        "shrink-0 text-sm",
                                        providerName
                                            ? isMine
                                                ? "font-bold text-primary"
                                                : "font-medium text-foreground-secondary"
                                            : "font-semibold text-error",
                                    )}
                                >
                                    {providerName ? (isMine ? `${providerName} (you)` : providerName) : "Unfilled"}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
