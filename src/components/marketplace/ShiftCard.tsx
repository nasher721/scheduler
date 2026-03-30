import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import type { MarketplaceShift, ShiftLifecycleStatus } from '@/types';
import { useTheme } from '@/hooks/useTheme';

interface ShiftCardProps {
  shift: MarketplaceShift;
  postedByName?: string;
  claimedByName?: string;
  onClaim?: (shiftId: string) => void;
  onCancel?: (shiftId: string) => void;
  onViewDetails?: (shiftId: string) => void;
  isOwnShift?: boolean;
  isAdmin?: boolean;
  isLoading?: boolean;
}

interface ShiftCardProps {
  shift: MarketplaceShift;
  postedByName?: string;
  claimedByName?: string;
  onClaim?: (shiftId: string) => void;
  onCancel?: (shiftId: string) => void;
  onViewDetails?: (shiftId: string) => void;
  isOwnShift?: boolean;
  isAdmin?: boolean;
  isLoading?: boolean;
}

export function ShiftCard({
  shift,
  postedByName = 'Unknown',
  claimedByName,
  onClaim,
  onCancel,
  onViewDetails,
  isOwnShift = false,
  isAdmin = false,
  isLoading = false,
}: ShiftCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const statusConfig: Record<ShiftLifecycleStatus, { 
    label: string; 
    bgClass: string; 
    textClass: string;
    canClaim: boolean;
    canCancel: boolean;
  }> = {
    POSTED: {
      label: 'Posted',
      bgClass: isDark ? 'bg-blue-500/20' : 'bg-blue-100',
      textClass: isDark ? 'text-blue-400' : 'text-blue-700',
      canClaim: true,
      canCancel: true,
    },
    AI_EVALUATING: {
      label: 'AI Evaluating',
      bgClass: isDark ? 'bg-purple-500/20' : 'bg-purple-100',
      textClass: isDark ? 'text-purple-400' : 'text-purple-700',
      canClaim: false,
      canCancel: false,
    },
    BROADCASTING: {
      label: 'Broadcasting',
      bgClass: isDark ? 'bg-amber-500/20' : 'bg-amber-100',
      textClass: isDark ? 'text-amber-400' : 'text-amber-700',
      canClaim: true,
      canCancel: true,
    },
    CLAIMED: {
      label: 'Claimed',
      bgClass: isDark ? 'bg-cyan-500/20' : 'bg-cyan-100',
      textClass: isDark ? 'text-cyan-400' : 'text-cyan-700',
      canClaim: false,
      canCancel: false,
    },
    APPROVED: {
      label: 'Approved',
      bgClass: isDark ? 'bg-green-500/20' : 'bg-green-100',
      textClass: isDark ? 'text-green-400' : 'text-green-700',
      canClaim: false,
      canCancel: false,
    },
    CANCELLED: {
      label: 'Cancelled',
      bgClass: isDark ? 'bg-slate-500/20' : 'bg-slate-100',
      textClass: isDark ? 'text-slate-400' : 'text-slate-600',
      canClaim: false,
      canCancel: false,
    },
  };

  const status = statusConfig[shift.lifecycleState];
  const shiftDate = parseISO(shift.date);
  const isPastShift = isPast(shiftDate) && !isToday(shiftDate);
  const isUrgent = isToday(shiftDate) || isTomorrow(shiftDate);

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const formatTime = (shiftType: string) => {
    const timeMap: Record<string, string> = {
      DAY: '7:00 AM - 7:00 PM',
      NIGHT: '7:00 PM - 7:00 AM',
      NMET: '7:00 AM - 5:00 PM',
      JEOPARDY: '12:00 PM - 8:00 PM',
      RECOVERY: '6:00 AM - 6:00 PM',
      CONSULTS: '24 hours',
      VACATION: 'N/A',
    };
    return timeMap[shiftType] || shiftType;
  };

  const canAct = (isOwnShift || isAdmin) && status.canCancel && shift.lifecycleState !== 'CLAIMED' && shift.lifecycleState !== 'APPROVED';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative rounded-xl border overflow-hidden transition-all ${
        isDark 
          ? `bg-slate-800 border-slate-700 ${isPastShift ? 'opacity-60' : ''}`
          : `bg-white border-slate-200 ${isPastShift ? 'opacity-60' : ''}`
      } ${isUrgent && !isPastShift ? 'ring-2 ring-amber-400 ring-offset-2' : ''} ${
        isDark ? 'ring-offset-slate-900' : 'ring-offset-white'
      }`}
    >
      {/* Urgent Badge */}
      {isUrgent && !isPastShift && (
        <div className="absolute -top-px -right-px z-10">
          <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
            {isToday(shiftDate) ? 'TODAY' : 'TOMORROW'}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              isDark ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Calendar className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {formatDateLabel(shiftDate)}
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {format(shiftDate, 'yyyy-MM-dd')}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.bgClass} ${status.textClass}`}>
            {status.label}
          </span>
        </div>

        {/* Shift Details */}
        <div className="space-y-2">
          {/* Shift Type */}
          <div className={`flex items-center gap-2 text-sm ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <Clock className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <span className="font-medium">{shift.shiftType}</span>
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              • {formatTime(shift.shiftType)}
            </span>
          </div>

          {/* Location */}
          <div className={`flex items-center gap-2 text-sm ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <MapPin className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <span>{shift.location}</span>
          </div>

          {/* Posted By */}
          <div className={`flex items-center gap-2 text-sm ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <User className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <span>Posted by {postedByName}</span>
          </div>

          {/* Claimed By (if applicable) */}
          {shift.lifecycleState === 'CLAIMED' && (
            <div className={`flex items-center gap-2 text-sm ${
              isDark ? 'text-cyan-300' : 'text-cyan-700'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Claimed by {claimedByName}</span>
            </div>
          )}
        </div>

        {/* Notes (if any) */}
        {shift.notes && (
          <div className={`mt-3 p-2 rounded-lg text-sm ${
            isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-50 text-slate-600'
          }`}>
            <p className="line-clamp-2">{shift.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`px-4 pb-4 pt-0 flex gap-2 ${
        isDark ? 'border-t border-slate-700' : 'border-t border-slate-200'
      }`}>
        {status.canClaim && !isOwnShift && !isPastShift && (
          <button
            type="button"
            onClick={() => onClaim?.(shift.id)}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors min-h-[44px]"
            aria-label={`Claim shift on ${formatDateLabel(shiftDate)}`}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Claim Shift
              </>
            )}
          </button>
        )}

        {canAct && (
          <button
            type="button"
            onClick={() => onCancel?.(shift.id)}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors min-h-[44px] ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
            aria-label={`Cancel shift posted on ${formatDateLabel(shiftDate)}`}
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </button>
        )}

        {(shift.lifecycleState === 'CLAIMED' || shift.lifecycleState === 'APPROVED') && (
          <button
            type="button"
            onClick={() => onViewDetails?.(shift.id)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors min-h-[44px] ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
            aria-label={`View details for shift on ${formatDateLabel(shiftDate)}`}
          >
            View Details
          </button>
        )}
      </div>

      {/* Broadcast Recipients Indicator */}
      {shift.broadcastRecipients.length > 0 && (
        <div className={`px-4 pb-3 text-xs ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <span>{shift.broadcastRecipients.filter(r => r.viewedAt).length} viewed</span>
          <span className="mx-1">•</span>
          <span>{shift.broadcastRecipients.filter(r => r.respondedAt).length} responded</span>
        </div>
      )}
    </motion.div>
  );
}

export default ShiftCard;
