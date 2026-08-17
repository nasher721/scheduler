import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PersistedScheduleState } from '@/types';
import {
  useSaveScheduleStateMutation,
  useOptimizeWithSolverMutation,
  useCreateShiftRequestMutation,
  useReviewShiftRequestMutation,
  useSendNotificationMutation,
  useUpdateNotificationMutation,
  useDeleteNotificationMutation,
  useSendCopilotMessageMutation,
  useParseCopilotIntentMutation,
  useGetCopilotSuggestionsMutation,
  useMultiAgentOptimizeMutation,
  useApplyOptimizationResultMutation,
  usePostShiftForCoverageMutation,
  useClaimShiftMutation,
  useApproveShiftMutation,
  useDispatchBroadcastMutation,
  useEscalateBroadcastMutation,
} from '@/hooks/useMutationHooks';

const mocks = vi.hoisted(() => ({
  saveScheduleState: vi.fn(),
  optimizeWithSolver: vi.fn(),
  createShiftRequest: vi.fn(),
  reviewShiftRequest: vi.fn(),
  sendNotification: vi.fn(),
  updateNotification: vi.fn(),
  deleteNotification: vi.fn(),
  sendCopilotMessage: vi.fn(),
  parseCopilotIntent: vi.fn(),
  getCopilotSuggestions: vi.fn(),
  multiAgentOptimize: vi.fn(),
  applyOptimizationResult: vi.fn(),
  postShiftForCoverage: vi.fn(),
  claimShift: vi.fn(),
  approveShift: vi.fn(),
  dispatchBroadcast: vi.fn(),
  escalateBroadcast: vi.fn(),
}));

vi.mock('@/lib/api/scheduleState', () => ({
  saveScheduleState: mocks.saveScheduleState,
  optimizeWithSolver: mocks.optimizeWithSolver,
}));

vi.mock('@/lib/api/shiftRequests', () => ({
  createShiftRequest: mocks.createShiftRequest,
  reviewShiftRequest: mocks.reviewShiftRequest,
}));

vi.mock('@/lib/api/notifications', () => ({
  sendNotification: mocks.sendNotification,
  updateNotification: mocks.updateNotification,
  deleteNotification: mocks.deleteNotification,
}));

vi.mock('@/lib/api/copilot', () => ({
  sendCopilotMessage: mocks.sendCopilotMessage,
  parseCopilotIntent: mocks.parseCopilotIntent,
  getCopilotSuggestions: mocks.getCopilotSuggestions,
}));

vi.mock('@/lib/api/multiAgentOptimize', () => ({
  multiAgentOptimize: mocks.multiAgentOptimize,
  applyOptimizationResult: mocks.applyOptimizationResult,
}));

vi.mock('@/lib/api/marketplace', () => ({
  postShiftForCoverage: mocks.postShiftForCoverage,
  claimShift: mocks.claimShift,
  approveShift: mocks.approveShift,
}));

vi.mock('@/lib/api/broadcast', () => ({
  dispatchBroadcast: mocks.dispatchBroadcast,
  escalateBroadcast: mocks.escalateBroadcast,
}));

const scheduleState: PersistedScheduleState = {
  providers: [],
  slots: [],
  startDate: '2026-01-01',
  numWeeks: 2,
  scenarios: [],
  customRules: [],
  auditLog: [],
};
const context = { viewType: 'week' as const, userRole: 'ADMIN' as const };
const conversationHistory = [
  { id: 'm-1', role: 'user' as const, content: 'help', timestamp: '2026-08-16T00:00:00Z' },
];
const optimizationResult = { success: true, schedule: { providers: [], slots: [] } };

describe('useMutationHooks', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    mocks.saveScheduleState.mockResolvedValue({ ok: true });
    mocks.optimizeWithSolver.mockResolvedValue({ success: true, schedule: { providers: [], slots: [] } });
    mocks.createShiftRequest.mockResolvedValue({ id: 'req-2' });
    mocks.reviewShiftRequest.mockResolvedValue({ ok: true });
    mocks.sendNotification.mockResolvedValue({ id: 'n-2' });
    mocks.updateNotification.mockResolvedValue({ ok: true });
    mocks.deleteNotification.mockResolvedValue({ ok: true });
    mocks.sendCopilotMessage.mockResolvedValue({ reply: 'ok' });
    mocks.parseCopilotIntent.mockResolvedValue({ intent: 'explain_assignment' });
    mocks.getCopilotSuggestions.mockResolvedValue({ suggestions: [] });
    mocks.multiAgentOptimize.mockResolvedValue(optimizationResult);
    mocks.applyOptimizationResult.mockResolvedValue({ ok: true });
    mocks.postShiftForCoverage.mockResolvedValue({ id: 'shift-2' });
    mocks.claimShift.mockResolvedValue({ ok: true });
    mocks.approveShift.mockResolvedValue({ ok: true });
    mocks.dispatchBroadcast.mockResolvedValue({ entryId: 'e-2', tier: 1, recipients: 2 });
    mocks.escalateBroadcast.mockResolvedValue({ entryId: 'e-2', tier: 2, recipients: 5 });
  });

  it('useSaveScheduleStateMutation persists schedule state', async () => {
    const { result } = renderHook(() => useSaveScheduleStateMutation(), { wrapper });
    act(() => result.current.mutate(scheduleState));
    await waitFor(() => expect(mocks.saveScheduleState).toHaveBeenCalledTimes(1));
    // Bare-fn mutationFns receive (variables, mutationFnContext) in react-query v5
    expect(mocks.saveScheduleState.mock.calls[0][0]).toEqual(scheduleState);
    expect(mocks.saveScheduleState.mock.calls[0][1]).toEqual(
      expect.objectContaining({ client: expect.anything() }),
    );
  });

  it('useOptimizeWithSolverMutation calls solver', async () => {
    const { result } = renderHook(() => useOptimizeWithSolverMutation(), { wrapper });
    act(() => result.current.mutate({ state: scheduleState, solverProfile: 'balanced' }));
    await waitFor(() => expect(mocks.optimizeWithSolver).toHaveBeenCalledTimes(1));
    expect(mocks.optimizeWithSolver.mock.calls[0][0]).toEqual({
      state: scheduleState,
      solverProfile: 'balanced',
    });
  });

  it('useCreateShiftRequestMutation creates shift request', async () => {
    const { result } = renderHook(() => useCreateShiftRequestMutation(), { wrapper });
    act(() =>
      result.current.mutate({ providerName: 'Dr. Smith', date: '2026-01-01', type: 'time_off' }),
    );
    await waitFor(() => expect(mocks.createShiftRequest).toHaveBeenCalledTimes(1));
    expect(mocks.createShiftRequest.mock.calls[0][0]).toEqual({
      providerName: 'Dr. Smith',
      date: '2026-01-01',
      type: 'time_off',
    });
  });

  it('useReviewShiftRequestMutation passes id and review payload', async () => {
    const { result } = renderHook(() => useReviewShiftRequestMutation(), { wrapper });
    act(() => result.current.mutate({ requestId: 'req-1', status: 'approved', reviewedBy: 'Dr. Test' }));
    await waitFor(() =>
      expect(mocks.reviewShiftRequest).toHaveBeenCalledWith('req-1', {
        status: 'approved',
        reviewedBy: 'Dr. Test',
      }),
    );
  });

  it('useSendNotificationMutation sends notification', async () => {
    const { result } = renderHook(() => useSendNotificationMutation(), { wrapper });
    act(() =>
      result.current.mutate({
        title: 'Shift reminder',
        body: 'Your shift starts in 30 minutes',
        severity: 'info',
      }),
    );
    await waitFor(() => expect(mocks.sendNotification).toHaveBeenCalledTimes(1));
    expect(mocks.sendNotification.mock.calls[0][0]).toEqual({
      title: 'Shift reminder',
      body: 'Your shift starts in 30 minutes',
      severity: 'info',
    });
  });

  it('useUpdateNotificationMutation updates notification', async () => {
    const { result } = renderHook(() => useUpdateNotificationMutation(), { wrapper });
    act(() => result.current.mutate({ id: 'n-1', payload: { status: 'read' } }));
    await waitFor(() =>
      expect(mocks.updateNotification).toHaveBeenCalledWith('n-1', { status: 'read' }),
    );
  });

  it('useDeleteNotificationMutation deletes notification', async () => {
    const { result } = renderHook(() => useDeleteNotificationMutation(), { wrapper });
    act(() => result.current.mutate('n-1'));
    await waitFor(() => expect(mocks.deleteNotification).toHaveBeenCalledTimes(1));
    expect(mocks.deleteNotification.mock.calls[0][0]).toEqual('n-1');
  });

  it('useSendCopilotMessageMutation sends message with context and history', async () => {
    const { result } = renderHook(() => useSendCopilotMessageMutation(), { wrapper });
    act(() => result.current.mutate({ message: 'who is on night shift?', context, history: conversationHistory }));
    await waitFor(() =>
      expect(mocks.sendCopilotMessage).toHaveBeenCalledWith('who is on night shift?', context, conversationHistory),
    );
  });

  it('useParseCopilotIntentMutation parses intent', async () => {
    const { result } = renderHook(() => useParseCopilotIntentMutation(), { wrapper });
    act(() => result.current.mutate({ text: 'assign provider A', context }));
    await waitFor(() =>
      expect(mocks.parseCopilotIntent).toHaveBeenCalledWith('assign provider A', context),
    );
  });

  it('useGetCopilotSuggestionsMutation fetches suggestions', async () => {
    const { result } = renderHook(() => useGetCopilotSuggestionsMutation(), { wrapper });
    act(() => result.current.mutate({ context }));
    await waitFor(() => expect(mocks.getCopilotSuggestions).toHaveBeenCalledWith(context));
  });

  it('useMultiAgentOptimizeMutation runs multi-agent optimization and invalidates schedule caches', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMultiAgentOptimizeMutation(), { wrapper });
    act(() => result.current.mutate(scheduleState));
    await waitFor(() => expect(mocks.multiAgentOptimize).toHaveBeenCalledTimes(1));
    expect(mocks.multiAgentOptimize.mock.calls[0][0]).toEqual(scheduleState);
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['schedule'] }));
  });

  it('useApplyOptimizationResultMutation applies result with approver and invalidates caches', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useApplyOptimizationResultMutation(), { wrapper });
    act(() => result.current.mutate({ result: optimizationResult, approvedBy: 'Dr. Test' }));
    await waitFor(() =>
      expect(mocks.applyOptimizationResult).toHaveBeenCalledWith(optimizationResult, 'Dr. Test'),
    );
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['schedule'] }));
  });

  it('useApplyOptimizationResultMutation accepts null approver', async () => {
    const { result } = renderHook(() => useApplyOptimizationResultMutation(), { wrapper });
    act(() => result.current.mutate({ result: optimizationResult, approvedBy: null }));
    await waitFor(() =>
      expect(mocks.applyOptimizationResult).toHaveBeenCalledWith(optimizationResult, null),
    );
  });

  it('usePostShiftForCoverageMutation posts shift for coverage', async () => {
    const { result } = renderHook(() => usePostShiftForCoverageMutation(), { wrapper });
    act(() => result.current.mutate({ slotId: 'slot-1', postedByProviderId: 'p-1', notes: 'urgent' }));
    await waitFor(() =>
      expect(mocks.postShiftForCoverage).toHaveBeenCalledWith('slot-1', 'p-1', 'urgent'),
    );
  });

  it('useClaimShiftMutation claims shift', async () => {
    const { result } = renderHook(() => useClaimShiftMutation(), { wrapper });
    act(() => result.current.mutate({ shiftId: 'shift-1', providerId: 'p-2' }));
    await waitFor(() =>
      expect(mocks.claimShift).toHaveBeenCalledWith('shift-1', 'p-2'),
    );
  });

  it('useApproveShiftMutation approves shift', async () => {
    const { result } = renderHook(() => useApproveShiftMutation(), { wrapper });
    act(() => result.current.mutate({ shiftId: 'shift-1', approvedBy: 'Dr. Test' }));
    await waitFor(() =>
      expect(mocks.approveShift).toHaveBeenCalledWith('shift-1', 'Dr. Test'),
    );
  });

  it('useDispatchBroadcastMutation dispatches broadcast to channel', async () => {
    const { result } = renderHook(() => useDispatchBroadcastMutation(), { wrapper });
    act(() => result.current.mutate({ shiftId: 'shift-1', channel: 'email', eligibleProviderIds: ['p-1', 'p-2'] }));
    await waitFor(() =>
      expect(mocks.dispatchBroadcast).toHaveBeenCalledWith('shift-1', 'email', ['p-1', 'p-2']),
    );
  });

  it('useEscalateBroadcastMutation escalates broadcast', async () => {
    const { result } = renderHook(() => useEscalateBroadcastMutation(), { wrapper });
    act(() => result.current.mutate('shift-1'));
    await waitFor(() => expect(mocks.escalateBroadcast).toHaveBeenCalledTimes(1));
    expect(mocks.escalateBroadcast.mock.calls[0][0]).toEqual('shift-1');
  });

  it('mutation errors propagate', async () => {
    mocks.saveScheduleState.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSaveScheduleStateMutation(), { wrapper });
    act(() => result.current.mutate(scheduleState));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
