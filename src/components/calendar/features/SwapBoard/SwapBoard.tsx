/**
 * SwapBoard Component
 * 
 * Shift swap marketplace for providers to trade shifts.
 * Includes drag-to-swap functionality and approval workflow.
 * Part of Phase 2: Shift Management
 */

import { useState, useMemo } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import type { SwapRequest } from '@/types/calendar';
import { format, parseISO } from 'date-fns';
import { useAnnounce } from '../../hooks/useAnnounce';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRightLeft,
  Plus,
  Check,
  X,
  Clock,
  User,
  Calendar,
  AlertCircle,
  Search,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShiftType } from '../../utils/accessibilityUtils';

interface SwapBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock data for swap requests
const MOCK_SWAP_REQUESTS: SwapRequest[] = [
  {
    id: 'swap-1',
    fromSlotId: 'slot-1',
    fromProviderId: 'provider-1',
    toProviderId: 'provider-2',
    status: 'pending',
    requestedAt: new Date(Date.now() - 86400000).toISOString(),
    notes: 'Looking to swap my Friday night for a weekend day'
  }
];

export function SwapBoard({ isOpen, onClose }: SwapBoardProps) {
  const { slots, providers, currentUser } = useScheduleStore();
  const { announceSuccess } = useAnnounce();
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my-swaps' | 'pending'>('marketplace');
  const [filter, setFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);

  // Get available shifts for swap (user's shifts)
  const myShifts = useMemo(() => {
    if (!currentUser) return [];
    return slots.filter(s => s.providerId === currentUser.id);
  }, [slots, currentUser]);

  // Get open swap requests
  const openRequests = useMemo(() => {
    return MOCK_SWAP_REQUESTS.filter(r => r.status === 'pending');
  }, []);

  // Get my swap requests
  const myRequests = useMemo(() => {
    if (!currentUser) return [];
    return MOCK_SWAP_REQUESTS.filter(r => 
      r.fromProviderId === currentUser.id || r.toProviderId === currentUser.id
    );
  }, [currentUser]);

  const handleCreateSwapRequest = () => {
    // TODO: Open create swap request modal
    console.log('Create swap request');
  };

  const handleAcceptSwap = (request: SwapRequest) => {
    // TODO: Accept swap request
    announceSuccess('Swap request accepted');
    onClose();
  };

  const handleRejectSwap = (request: SwapRequest) => {
    // TODO: Reject swap request
    announceSuccess('Swap request rejected');
  };

  const handleCancelSwap = (request: SwapRequest) => {
    // TODO: Cancel swap request
    announceSuccess('Swap request cancelled');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Shift Swap Board
          </DialogTitle>
          <DialogDescription>
            Trade shifts with other providers or offer your shifts to the pool
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="marketplace">
                Marketplace
                {openRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {openRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="my-swaps">My Swaps</TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                {myRequests.filter(r => r.status === 'pending').length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {myRequests.filter(r => r.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <Button onClick={handleCreateSwapRequest}>
              <Plus className="w-4 h-4 mr-2" />
              Request Swap
            </Button>
          </div>

          <TabsContent value="marketplace" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {openRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <ArrowRightLeft className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                      No open swap requests
                    </h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
                      Be the first to offer a shift swap or check back later
                    </p>
                    <Button onClick={handleCreateSwapRequest}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Swap Request
                    </Button>
                  </div>
                ) : (
                  openRequests.map(request => (
                    <SwapRequestCard
                      key={request.id}
                      request={request}
                      slots={slots}
                      providers={providers}
                      onAccept={() => handleAcceptSwap(request)}
                      onReject={() => handleRejectSwap(request)}
                      isIncoming={request.toProviderId === currentUser?.id}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="my-swaps" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {myRequests.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    You haven&apos;t created any swap requests yet
                  </div>
                ) : (
                  myRequests.map(request => (
                    <SwapRequestCard
                      key={request.id}
                      request={request}
                      slots={slots}
                      providers={providers}
                      onCancel={() => handleCancelSwap(request)}
                      isMine
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="pending" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {myRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No pending swap requests
                  </div>
                ) : (
                  myRequests
                    .filter(r => r.status === 'pending')
                    .map(request => (
                      <SwapRequestCard
                        key={request.id}
                        request={request}
                        slots={slots}
                        providers={providers}
                        onAccept={() => handleAcceptSwap(request)}
                        onReject={() => handleRejectSwap(request)}
                        isIncoming={request.toProviderId === currentUser?.id}
                      />
                    ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Swap Request Card Component
function SwapRequestCard({
  request,
  slots,
  providers,
  onAccept,
  onReject,
  onCancel,
  isMine,
  isIncoming
}: {
  request: SwapRequest;
  slots: ShiftSlot[];
  providers: Provider[];
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  isMine?: boolean;
  isIncoming?: boolean;
}) {
  const fromSlot = slots.find(s => s.id === request.fromSlotId);
  const toSlot = request.toSlotId ? slots.find(s => s.id === request.toSlotId) : null;
  const fromProvider = providers.find(p => p.id === request.fromProviderId);
  const toProvider = request.toProviderId ? providers.find(p => p.id === request.toProviderId) : null;

  if (!fromSlot || !fromProvider) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
            {fromProvider.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900">
              {isMine ? 'You' : fromProvider.name} want{isMine ? '' : 's'} to swap
            </p>
            <p className="text-xs text-slate-500">
              {format(parseISO(request.requestedAt), 'MMM d, h:mm a')}
            </p>
          </div>
        </div>
        <Badge 
          variant={request.status === 'pending' ? 'outline' : request.status === 'approved' ? 'default' : 'secondary'}
          className={cn(
            request.status === 'pending' && 'border-amber-200 text-amber-700 bg-amber-50',
            request.status === 'approved' && 'bg-emerald-500',
            request.status === 'rejected' && 'bg-rose-500'
          )}
        >
          {request.status}
        </Badge>
      </div>

      {/* Shift Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Offering</p>
          <p className="font-medium text-slate-900">
            {formatShiftType(fromSlot.type)} shift
          </p>
          <p className="text-sm text-slate-600">
            {format(parseISO(fromSlot.date), 'EEEE, MMMM do')}
          </p>
          <p className="text-sm text-slate-500">{fromSlot.serviceLocation}</p>
        </div>

        {toSlot && toProvider && (
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">In exchange for</p>
            <p className="font-medium text-slate-900">
              {formatShiftType(toSlot.type)} shift
            </p>
            <p className="text-sm text-slate-600">
              {format(parseISO(toSlot.date), 'EEEE, MMMM do')}
            </p>
            <p className="text-sm text-slate-500">{toSlot.serviceLocation}</p>
          </div>
        )}

        {!toSlot && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center">
            <p className="text-sm text-amber-700 text-center">
              Open to any shift<br />
              <span className="text-xs">Make an offer</span>
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      {request.notes && (
        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
          &ldquo;{request.notes}&rdquo;
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {isMine ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel Request
          </Button>
        ) : isIncoming ? (
          <>
            <Button variant="outline" size="sm" onClick={onReject}>
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
            <Button size="sm" onClick={onAccept}>
              <Check className="w-4 h-4 mr-2" />
              Accept Swap
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Make Offer
          </Button>
        )}
      </div>
    </div>
  );
}

// Button to open swap board
export function SwapBoardButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <ArrowRightLeft className="w-4 h-4 mr-2" />
        Swaps
      </Button>
      <SwapBoard isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
