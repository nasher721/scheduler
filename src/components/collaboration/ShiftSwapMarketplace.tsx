import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  Clock, 
  User, 
  Check, 
  X, 
  AlertCircle,
  Filter,
  Search,
  Calendar
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useScheduleStore, type SwapRequest } from '@/store';
import { useToast } from '@/hooks/useToast';
import { useOfflineMode } from '@/lib/pwa/offlineMode';

interface SwapCardProps {
  swap: SwapRequest;
  providerName: string;
  targetName?: string;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onCancel: (id: string) => void;
  isAdmin: boolean;
  isRequestor: boolean;
}

function SwapCard({ 
  swap, 
  providerName, 
  targetName,
  onApprove, 
  onReject, 
  onCancel,
  isAdmin,
  isRequestor 
}: SwapCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const statusColors = {
    pending: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700',
    approved: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
    rejected: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
    cancelled: isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-600',
  };

  const canAct = swap.status === 'pending' && (isAdmin || !isRequestor);
  const canCancel = swap.status === 'pending' && isRequestor;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl border p-4 ${
        isDark 
          ? 'bg-slate-800 border-slate-700' 
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            isDark ? 'bg-blue-500/20' : 'bg-blue-100'
          }`}>
            <RefreshCw className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Swap Request
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {new Date(swap.requestedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[swap.status]}`}>
          {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
        </span>
      </div>

      {/* Swap Details */}
      <div className="space-y-3 mb-4">
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          isDark ? 'bg-slate-700/50' : 'bg-slate-50'
        }`}>
          <User className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <div className="flex-1">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <span className="font-medium">{providerName}</span> wants to swap
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {swap.fromDate}: {swap.fromShiftType}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <RefreshCw className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </div>

        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          isDark ? 'bg-slate-700/50' : 'bg-slate-50'
        }`}>
          <Calendar className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <div className="flex-1">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {targetName ? (
                <><span className="font-medium">{targetName}</span>'s shift</>
              ) : (
                'Any available provider'
              )}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {swap.toDate}: {swap.toShiftType}
            </p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {swap.notes && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'
        }`}>
          <p className="font-medium mb-1">Note:</p>
          <p>{swap.notes}</p>
        </div>
      )}

      {/* Actions */}
      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(swap.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={() => setShowRejectReason(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}

      {canCancel && (
        <button
          onClick={() => onCancel(swap.id)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isDark 
              ? 'bg-slate-700 hover:bg-slate-600 text-white' 
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
          }`}
        >
          <X className="w-4 h-4" />
          Cancel Request
        </button>
      )}

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {showRejectReason && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className={`w-full p-3 rounded-lg text-sm ${
                isDark 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' 
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
              } border`}
              rows={2}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  onReject(swap.id, rejectReason);
                  setShowRejectReason(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setShowRejectReason(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  isDark 
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Errors */}
      {swap.validationErrors && swap.validationErrors.length > 0 && (
        <div className={`mt-3 p-3 rounded-lg ${
          isDark ? 'bg-red-500/10' : 'bg-red-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              Validation Issues
            </p>
          </div>
          <ul className="space-y-1">
            {swap.validationErrors.map((error, i) => (
              <li key={i} className={`text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                • {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

export function ShiftSwapMarketplace() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const toast = useToast();
  const { isOnline } = useOfflineMode();
  
  const providers = useScheduleStore((s) => s.providers);
  const currentUser = useScheduleStore((s) => s.currentUser);
  const swapRequests = useScheduleStore((s) => s.swapRequests);
  const approveSwapRequest = useScheduleStore((s) => s.approveSwapRequest);
  const rejectSwapRequest = useScheduleStore((s) => s.rejectSwapRequest);
  const cancelSwapRequest = useScheduleStore((s) => s.cancelSwapRequest);

  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SCHEDULER';

  const filteredSwaps = swapRequests.filter((swap) => {
    if (filter !== 'all' && swap.status !== filter) return false;
    
    if (searchTerm) {
      const requestor = providers.find((p) => p.id === swap.requestorId);
      const target = swap.targetProviderId 
        ? providers.find((p) => p.id === swap.targetProviderId)
        : null;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        requestor?.name.toLowerCase().includes(searchLower) ||
        target?.name.toLowerCase().includes(searchLower) ||
        swap.fromDate.includes(searchLower) ||
        swap.toDate.includes(searchLower)
      );
    }
    
    return true;
  });

  const handleApprove = useCallback((id: string) => {
    if (!isOnline) {
      toast.error('Cannot approve while offline');
      return;
    }
    approveSwapRequest(id, currentUser!.id);
    toast.success('Swap request approved');
  }, [isOnline, approveSwapRequest, currentUser, toast]);

  const handleReject = useCallback((id: string, reason?: string) => {
    if (!isOnline) {
      toast.error('Cannot reject while offline');
      return;
    }
    rejectSwapRequest(id, currentUser!.id, reason);
    toast.success('Swap request rejected');
  }, [isOnline, rejectSwapRequest, currentUser, toast]);

  const handleCancel = useCallback((id: string) => {
    cancelSwapRequest(id);
    toast.success('Swap request cancelled');
  }, [cancelSwapRequest, toast]);

  const pendingCount = swapRequests.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`p-4 rounded-xl border ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Shift Swap Marketplace
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className={`flex rounded-lg overflow-hidden border ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    filter === f
                      ? isDark 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-600 text-white'
                      : isDark 
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border ${
          isDark 
            ? 'bg-slate-700 border-slate-600' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <Search className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by provider or date..."
            className={`flex-1 bg-transparent border-none outline-none text-sm ${
              isDark 
                ? 'text-white placeholder:text-slate-500' 
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className={`p-1 rounded ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}
            >
              <X className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Swaps List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredSwaps.length === 0 ? (
            <div className={`col-span-full py-12 text-center ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No swap requests found</p>
              <p className="text-sm mt-1">
                {filter === 'all' 
                  ? 'Requests will appear here when providers propose swaps' 
                  : `No ${filter} requests`}
              </p>
            </div>
          ) : (
            filteredSwaps.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                providerName={providers.find((p) => p.id === swap.requestorId)?.name || 'Unknown'}
                targetName={swap.targetProviderId 
                  ? providers.find((p) => p.id === swap.targetProviderId)?.name 
                  : undefined}
                onApprove={handleApprove}
                onReject={handleReject}
                onCancel={handleCancel}
                isAdmin={isAdmin}
                isRequestor={swap.requestorId === currentUser?.id}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ShiftSwapMarketplace;
