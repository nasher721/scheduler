import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { useScheduleStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { ShiftType } from '@/types';

interface QuickSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}


const isPastShift = (dateStr: string): boolean => {
  const date = parseISO(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const formatShiftType = (type: ShiftType): string => {
  const typeMap: Record<string, string> = {
    DAY: 'Day',
    NIGHT: 'Night',
    NMET: 'NMET',
    JEOPARDY: 'Jeopardy',
    RECOVERY: 'Recovery',
    CONSULTS: 'Consults',
    VACATION: 'Vacation',
  };
  return typeMap[type] || type;
};

const formatTime = (type: ShiftType): string => {
  const timeMap: Record<string, string> = {
    DAY: '7:00 AM - 7:00 PM',
    NIGHT: '7:00 PM - 7:00 AM',
    NMET: '7:00 AM - 5:00 PM',
    JEOPARDY: '12:00 PM - 8:00 PM',
    RECOVERY: '6:00 AM - 6:00 PM',
    CONSULTS: '24 hours',
    VACATION: 'N/A',
  };
  return timeMap[type] || '';
};

const formatDateLabel = (dateStr: string): string => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
};

export function QuickSwapModal({ isOpen, onClose }: QuickSwapModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const currentUser = useScheduleStore((s) => s.currentUser);
  const slots = useScheduleStore((s) => s.slots);
  const providers = useScheduleStore((s) => s.providers);
  const marketplaceShifts = useScheduleStore((s) => s.marketplaceShifts);
  const postShiftForCoverage = useScheduleStore((s) => s.postShiftForCoverage);
  const showToast = useScheduleStore((s) => s.showToast);

  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const myShifts = useMemo(() => {
    if (!currentUser) return [];

    const postedSlotIds = new Set(marketplaceShifts.map(m => m.slotId));

    return slots
      .filter(slot =>
        slot.providerId === currentUser.id &&
        !postedSlotIds.has(slot.id) &&
        !isPastShift(slot.date)
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentUser, slots, marketplaceShifts]);

  const coverageCandidates = useMemo(() => {
    if (!selectedShiftId) return [];

    const selectedSlot = slots.find(s => s.id === selectedShiftId);
    if (!selectedSlot) return [];

    const requiredSkill = selectedSlot.requiredSkill;

    return providers
      .filter(provider => {
        if (!provider.skills.includes(requiredSkill)) return false;
        if (provider.id === currentUser?.id) return false;

        const hasConflict = slots.some(s =>
          s.date === selectedSlot.date &&
          s.providerId === provider.id
        );
        if (hasConflict) return false;

        const hasTimeOff = provider.timeOffRequests?.some(
          to => to.date === selectedSlot.date
        );
        if (hasTimeOff) return false;

        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedShiftId, slots, providers, currentUser]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedShiftId(null);
      setIsPosting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handlePostForCoverage = useCallback(async () => {
    if (!selectedShiftId || !currentUser) return;

    setIsPosting(true);
    try {
      postShiftForCoverage(selectedShiftId, currentUser.id, '');
      showToast({
        type: 'success',
        title: 'Shift Posted',
        message: 'Your shift has been posted to the marketplace for coverage.'
      });
      onClose();
    } catch {
      showToast({
        type: 'error',
        title: 'Post Failed',
        message: 'Unable to post shift for coverage. Please try again.'
      });
    } finally {
      setIsPosting(false);
    }
  }, [selectedShiftId, currentUser, postShiftForCoverage, showToast, onClose]);

  if (!currentUser) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                'relative w-full max-w-md rounded-2xl border p-6 shadow-2xl',
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              )}
            >
              <div className="text-center">
                <User className={cn('mx-auto h-12 w-12 mb-4', isDark ? 'text-slate-400' : 'text-slate-500')} />
                <h3 className={cn('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-slate-900')}>
                  Sign In Required
                </h3>
                <p className={cn('text-sm mb-4', isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Please sign in to post a shift for coverage.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-medium transition-colors',
                    isDark
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  )}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'relative w-full max-w-lg max-h-[90vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col',
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            )}
          >
            <div className={cn(
              'flex items-center justify-between p-4 border-b',
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <div>
                <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  Post for Coverage
                </h2>
                <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Select a shift to post to the marketplace
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
                  isDark
                    ? 'hover:bg-slate-700 text-slate-400'
                    : 'hover:bg-slate-100 text-slate-500'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selectedShiftId ? (
                <div className="space-y-3">
                  <h3 className={cn('text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>
                    Your Assigned Shifts
                  </h3>
                  {myShifts.length === 0 ? (
                    <div className={cn(
                      'text-center py-8 px-4 rounded-xl border',
                      isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                    )}>
                      <Calendar className={cn('mx-auto h-10 w-10 mb-3', isDark ? 'text-slate-500' : 'text-slate-400')} />
                      <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-600')}>
                        No shifts available to post.
                      </p>
                      <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-500')}>
                        You may already have all shifts covered or none assigned.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myShifts.map((shift) => (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setSelectedShiftId(shift.id)}
                          className={cn(
                            'w-full p-4 rounded-xl border text-left transition-all',
                            'min-h-[80px] flex items-center gap-4',
                            isDark
                              ? 'bg-slate-700/50 border-slate-600 hover:border-blue-500 hover:bg-slate-700'
                              : 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-slate-100'
                          )}
                        >
                          <div className={cn(
                            'flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center',
                            isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                          )}>
                            <Calendar className={cn('w-5 h-5', isDark ? 'text-blue-400' : 'text-blue-600')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'font-medium',
                                isDark ? 'text-white' : 'text-slate-900'
                              )}>
                                {formatDateLabel(shift.date)}
                              </span>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                              )}>
                                {formatShiftType(shift.type)}
                              </span>
                            </div>
                            <div className={cn(
                              'text-sm mt-1 flex items-center gap-3',
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            )}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {formatTime(shift.type)}
                              </span>
                              {shift.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {shift.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className={cn('flex-shrink-0 w-5 h-5', isDark ? 'text-slate-500' : 'text-slate-400')} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setSelectedShiftId(null)}
                    className={cn(
                      'text-sm flex items-center gap-1 transition-colors',
                      isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-700'
                    )}
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    Back to shifts
                  </button>

                  {(() => {
                    const selectedSlot = slots.find(s => s.id === selectedShiftId);
                    if (!selectedSlot) return null;
                    return (
                      <div className={cn(
                        'p-4 rounded-xl border',
                        isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className={cn('w-5 h-5', isDark ? 'text-blue-400' : 'text-blue-600')} />
                          <span className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                            Selected Shift
                          </span>
                        </div>
                        <div className={cn('text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
                          {formatDateLabel(selectedSlot.date)} • {formatShiftType(selectedSlot.type)}
                        </div>
                        <div className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                          {formatTime(selectedSlot.type)} • {selectedSlot.location || 'No location'}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-3">
                    <h3 className={cn('text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      Suggested Coverage Providers
                    </h3>
                    {coverageCandidates.length === 0 ? (
                      <div className={cn(
                        'text-center py-6 px-4 rounded-xl border',
                        isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                      )}>
                        <User className={cn('mx-auto h-8 w-8 mb-2', isDark ? 'text-slate-500' : 'text-slate-400')} />
                        <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-600')}>
                          No matching providers available
                        </p>
                        <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-500')}>
                          You can still post and we'll broadcast to everyone.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {coverageCandidates.slice(0, 5).map((provider) => (
                          <div
                            key={provider.id}
                            className={cn(
                              'p-3 rounded-lg border flex items-center gap-3',
                              isDark
                                ? 'bg-slate-700/50 border-slate-600'
                                : 'bg-slate-50 border-slate-200'
                            )}
                          >
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                              isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-700'
                            )}>
                              {provider.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-slate-900')}>
                                {provider.name}
                              </div>
                              <div className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-500')}>
                                {provider.skills.slice(0, 3).join(', ')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedShiftId && (
              <div className={cn(
                'p-4 border-t',
                isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
              )}>
                <button
                  type="button"
                  onClick={handlePostForCoverage}
                  disabled={isPosting}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-medium transition-all',
                    'min-h-[48px] flex items-center justify-center gap-2',
                    isDark
                      ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white'
                  )}
                >
                  {isPosting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Post for Coverage
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
