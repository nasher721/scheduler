import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type SwapRequest } from "../store";
import { format, parseISO } from "date-fns";
import { 
  ArrowRightLeft, 
  Check, 
  X, 
  Clock, 
  User,
  Calendar,
  AlertCircle,
  Filter,
  MessageSquare
} from "lucide-react";

interface ShiftSwapBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

type SwapStatusColumn = 'pending' | 'approved' | 'rejected';

const columnConfig: Record<SwapStatusColumn, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    icon: <Clock className="w-4 h-4" />
  },
  approved: {
    label: 'Approved',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    icon: <Check className="w-4 h-4" />
  },
  rejected: {
    label: 'Rejected',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    icon: <X className="w-4 h-4" />
  }
};

export function ShiftSwapBoard({ isOpen, onClose }: ShiftSwapBoardProps) {
  const { 
    swapRequests, 
    providers, 
    approveSwapRequest, 
    rejectSwapRequest,
    currentUser 
  } = useScheduleStore();
  
  const [filterStatus, setFilterStatus] = useState<SwapStatusColumn | 'all'>('all');
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const getProviderName = (id: string) => {
    return providers.find(p => p.id === id)?.name || 'Unknown';
  };

  const filteredRequests = swapRequests.filter(request => {
    if (filterStatus === 'all') return true;
    return request.status === filterStatus;
  }).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  const groupedRequests = {
    pending: filteredRequests.filter(r => r.status === 'pending'),
    approved: filteredRequests.filter(r => r.status === 'approved'),
    rejected: filteredRequests.filter(r => r.status === 'rejected')
  };

  const handleApprove = (swapId: string) => {
    if (currentUser) {
      approveSwapRequest(swapId, currentUser.id);
    }
    setSelectedSwap(null);
  };

  const handleReject = (swapId: string) => {
    if (currentUser) {
      rejectSwapRequest(swapId, currentUser.id, rejectReason);
    }
    setRejectReason('');
    setSelectedSwap(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Shift Swap Board</h2>
                  <p className="text-sm text-slate-500">
                    {swapRequests.filter(r => r.status === 'pending').length} pending requests
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Filter */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as SwapStatusColumn | 'all')}
                    className="bg-transparent border-none text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="all">All Requests</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-w-[800px]">
                {(Object.keys(columnConfig) as SwapStatusColumn[]).map((status) => (
                  <div key={status} className="flex flex-col">
                    {/* Column Header */}
                    <div className={`flex items-center justify-between p-3 rounded-t-xl ${columnConfig[status].bgColor}`}>
                      <div className="flex items-center gap-2">
                        {columnConfig[status].icon}
                        <span className={`font-semibold ${columnConfig[status].color}`}>
                          {columnConfig[status].label}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${columnConfig[status].bgColor} ${columnConfig[status].color}`}>
                        {groupedRequests[status].length}
                      </span>
                    </div>

                    {/* Column Content */}
                    <div className={`flex-1 p-3 rounded-b-xl min-h-[400px] ${columnConfig[status].bgColor} bg-opacity-50`}>
                      <div className="space-y-3">
                        {groupedRequests[status].map((request) => (
                          <motion.div
                            key={request.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-white rounded-xl p-4 border shadow-sm cursor-pointer transition-all hover:shadow-md ${
                              selectedSwap?.id === request.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
                            }`}
                            onClick={() => setSelectedSwap(selectedSwap?.id === request.id ? null : request)}
                          >
                            {/* Swap Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                  {getProviderName(request.requestorId).charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {getProviderName(request.requestorId)}
                                  </p>
                                  <p className="text-xs text-slate-500">Requested swap</p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-400">
                                {format(parseISO(request.requestedAt), "MMM d, h:mm a")}
                              </span>
                            </div>

                            {/* Swap Details */}
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">
                                  <span className="font-medium">{format(parseISO(request.fromDate), "MMM d")}</span>
                                  {' '}({request.fromShiftType}) 
                                  <ArrowRightLeft className="w-3 h-3 inline mx-1 text-slate-400" />
                                  <span className="font-medium">{format(parseISO(request.toDate), "MMM d")}</span>
                                  {' '}({request.toShiftType})
                                </span>
                              </div>
                              
                              {request.targetProviderId && (
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="w-4 h-4 text-slate-400" />
                                  <span className="text-slate-600">
                                    With: <span className="font-medium">{getProviderName(request.targetProviderId)}</span>
                                  </span>
                                </div>
                              )}

                              {request.notes && (
                                <div className="flex items-start gap-2 text-sm">
                                  <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                                  <span className="text-slate-600 text-xs">{request.notes}</span>
                                </div>
                              )}
                            </div>

                            {/* Validation Errors */}
                            {request.validationErrors && request.validationErrors.length > 0 && (
                              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg mb-3">
                                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-700">
                                  {request.validationErrors.map((err, i) => (
                                    <p key={i}>{err}</p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions (only for pending) */}
                            {request.status === 'pending' && selectedSwap?.id === request.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="pt-3 border-t border-slate-100 space-y-2"
                              >
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprove(request.id);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReject(request.id);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                                
                                {/* Reject Reason Input */}
                                <input
                                  type="text"
                                  placeholder="Optional: Reason for rejection"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200"
                                />
                              </motion.div>
                            )}

                            {/* Resolved Info */}
                            {request.status !== 'pending' && request.resolvedAt && (
                              <div className="pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-500">
                                  {request.status === 'approved' ? 'Approved' : 'Rejected'} by {getProviderName(request.resolvedBy || '')}
                                  {' '}on {format(parseISO(request.resolvedAt), "MMM d, h:mm a")}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        ))}

                        {groupedRequests[status].length === 0 && (
                          <div className="text-center py-8 text-slate-400">
                            <p className="text-sm">No {status} requests</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
