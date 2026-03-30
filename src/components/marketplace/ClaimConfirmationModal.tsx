import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User,
  AlertTriangle,
  CheckCircle2,
  X,
  Send
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import type { MarketplaceShift } from '@/types';
import { useTheme } from '@/hooks/useTheme';

interface ClaimConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shiftId: string, notes?: string) => void;
  shift: MarketplaceShift | null;
  postedByName?: string;
  currentUserName?: string;
  isLoading?: boolean;
}

export function ClaimConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  shift,
  postedByName = 'Unknown',
  currentUserName = 'You',
  isLoading = false,
}: ClaimConfirmationModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [notes, setNotes] = useState('');

  if (!shift) return null;

  const shiftDate = parseISO(shift.date);
  const isUrgent = isToday(shiftDate) || isTomorrow(shiftDate);

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

  const handleConfirm = () => {
    onConfirm(shift.id, notes || undefined);
    if (!isLoading) {
      setNotes('');
    }
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg mx-4 ${
              isDark ? 'bg-slate-800' : 'bg-white'
            } rounded-2xl shadow-xl overflow-hidden`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className={`flex items-center justify-between p-4 border-b ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                  <Calendar className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <h2 id="modal-title" className={`text-lg font-semibold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Confirm Shift Claim
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'hover:bg-slate-700 text-slate-400' 
                    : 'hover:bg-slate-100 text-slate-500'
                }`}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {isUrgent && (
                <div className={`flex items-start gap-3 p-3 rounded-lg ${
                  isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                }`}>
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                    isDark ? 'text-amber-400' : 'text-amber-600'
                  }`} />
                  <div>
                    <p className={`font-medium text-sm ${
                      isDark ? 'text-amber-400' : 'text-amber-700'
                    }`}>
                      {isToday(shiftDate) ? 'Today' : 'Tomorrow'} Shift
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      isDark ? 'text-amber-300/70' : 'text-amber-600/70'
                    }`}>
                      This shift is happening soon. Make sure you can cover it before confirming.
                    </p>
                  </div>
                </div>
              )}

              <div className={`rounded-xl border p-4 ${
                isDark ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <h3 className={`font-medium mb-3 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Shift Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className={`w-4 h-4 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        {format(shiftDate, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className={`text-xs ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {isToday(shiftDate) ? 'Today' : isTomorrow(shiftDate) ? 'Tomorrow' : shift.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className={`w-4 h-4 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        {shift.shiftType}
                      </p>
                      <p className={`text-xs ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {formatTime(shift.shiftType)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className={`w-4 h-4 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                    <p className={`text-sm ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {shift.location}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <User className={`w-4 h-4 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                    <p className={`text-sm ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      Posted by {postedByName}
                    </p>
                  </div>
                </div>
              </div>

              {shift.notes && (
                <div className={`rounded-xl border p-4 ${
                  isDark ? 'border-slate-700 bg-slate-700/30' : 'border-slate-200 bg-slate-50'
                }`}>
                  <h4 className={`text-sm font-medium mb-2 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Notes from {postedByName}
                  </h4>
                  <p className={`text-sm ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {shift.notes}
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="claim-notes" className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Add a note (optional)
                </label>
                <textarea
                  id="claim-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for the original provider..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                    isDark 
                      ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' 
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div className={`rounded-xl border p-4 ${
                isDark 
                  ? 'border-slate-700 bg-blue-500/10' 
                  : 'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${
                    isDark ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <div>
                    <p className={`font-medium text-sm ${
                      isDark ? 'text-blue-400' : 'text-blue-700'
                    }`}>
                      You're claiming this shift for {currentUserName}
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      isDark ? 'text-blue-300/70' : 'text-blue-600/70'
                    }`}>
                      Once confirmed, the original provider will be notified and you'll be assigned to this shift.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex gap-3 p-4 border-t ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors min-h-[44px] ${
                  isDark 
                    ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors min-h-[44px]"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Confirm Claim
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ClaimConfirmationModal;
