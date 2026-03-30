import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBroadcast } from "@/hooks/useBroadcast";
import { useScheduleStore } from "@/store";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import type { ShiftSlot, MarketplaceShift } from "@/types";
import {
  Clock,
  MessageSquare,
  Mail,
  Bell,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Search
} from "lucide-react";

interface BroadcastHistoryListProps {
  limit?: number;
  showShiftInfo?: boolean;
  className?: string;
}

const CHANNEL_ICONS = {
  sms: MessageSquare,
  email: Mail,
  push: Bell,
};

const STATUS_STYLES = {
  sent: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50" },
  delivered: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
};

function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, "h:mm a")}`;
  }
  return format(date, "MMM d, h:mm a");
}

function getShiftInfo(shiftId: string, store: ReturnType<typeof useScheduleStore.getState>) {
  const marketplaceShift = store.marketplaceShifts.find((s: MarketplaceShift) => s.id === shiftId);
  if (!marketplaceShift) return null;
  
  const slot = store.slots.find((s: ShiftSlot) => s.id === marketplaceShift.slotId);
  return { marketplaceShift, slot };
}

export function BroadcastHistoryList({ limit = 10, showShiftInfo = true, className }: BroadcastHistoryListProps) {
  const store = useScheduleStore();
  const { broadcastHistory } = useBroadcast();

  const sortedHistory = useMemo(() => {
    return [...broadcastHistory]
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, limit);
  }, [broadcastHistory, limit]);

  if (sortedHistory.length === 0) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-8 text-center", className)}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Clock className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">No broadcast history</p>
        <p className="text-sm text-slate-500">Broadcasts will appear here once sent</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white", className)}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-900">Broadcast History</h3>
        <span className="text-xs text-slate-500">{sortedHistory.length} entries</span>
      </div>

      <div className="divide-y divide-slate-100">
        {sortedHistory.map((entry) => {
          const ChannelIcon = CHANNEL_ICONS[entry.channel];
          const statusStyle = STATUS_STYLES[entry.status];
          const StatusIcon = statusStyle.icon;
          const shiftInfo = showShiftInfo ? getShiftInfo(entry.marketplaceShiftId, store) : null;

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                statusStyle.bg
              )}>
                <ChannelIcon className={cn("h-4 w-4", statusStyle.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">
                    Tier {entry.tier} Broadcast
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    statusStyle.bg,
                    statusStyle.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {entry.status}
                  </span>
                </div>

                {showShiftInfo && shiftInfo && shiftInfo.slot && (
                  <div className="text-sm text-slate-600 mb-1">
                    <span className="font-medium">{shiftInfo.slot.type}</span>
                    <span className="mx-1">•</span>
                    <span>{format(parseISO(shiftInfo.slot.date), "EEE, MMM d")}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeDate(entry.sentAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="capitalize">{entry.channel}</span>
                  </span>
                  <span>
                    {entry.recipients.length} recipient{entry.recipients.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {broadcastHistory.length > limit && (
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Search className="h-4 w-4" />
            View all {broadcastHistory.length} broadcasts
          </button>
        </div>
      )}
    </div>
  );
}
