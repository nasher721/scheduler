import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ShiftRequestStatus } from '@/types';
import {
  useScheduleSummaryQuery,
  useScheduleScenariosQuery,
  useLastOptimizationResultQuery,
  useAgentToolsQuery,
  useShiftRequestsQuery,
  useEmailEventsQuery,
  useNotificationHistoryQuery,
  useApplyHistoryQuery,
  useApplyHistorySummaryQuery,
  useCopilotCapabilitiesQuery,
  useMarketplaceShiftsQuery,
  useBroadcastHistoryQuery,
} from '@/hooks/useScheduleQueries';

const mocks = vi.hoisted(() => ({
  fetchScheduleSummary: vi.fn(),
  fetchScheduleScenarios: vi.fn(),
  fetchLastOptimizationResult: vi.fn(),
  fetchAgentTools: vi.fn(),
  listShiftRequests: vi.fn(),
  listEmailEvents: vi.fn(),
  listNotificationHistory: vi.fn(),
  fetchApplyHistory: vi.fn(),
  fetchApplyHistorySummary: vi.fn(),
  getCopilotCapabilities: vi.fn(),
  getMarketplaceShifts: vi.fn(),
  getBroadcastHistory: vi.fn(),
}));

vi.mock('@/lib/api/scheduleApi', () => ({
  fetchScheduleSummary: mocks.fetchScheduleSummary,
  fetchScheduleScenarios: mocks.fetchScheduleScenarios,
  fetchLastOptimizationResult: mocks.fetchLastOptimizationResult,
  fetchAgentTools: mocks.fetchAgentTools,
}));

vi.mock('@/lib/api/shiftRequests', () => ({
  listShiftRequests: mocks.listShiftRequests,
  listEmailEvents: mocks.listEmailEvents,
}));

vi.mock('@/lib/api/notifications', () => ({
  listNotificationHistory: mocks.listNotificationHistory,
}));

vi.mock('@/lib/api/aiApplyHistory', () => ({
  fetchApplyHistory: mocks.fetchApplyHistory,
  fetchApplyHistorySummary: mocks.fetchApplyHistorySummary,
}));

vi.mock('@/lib/api/copilot', () => ({
  getCopilotCapabilities: mocks.getCopilotCapabilities,
}));

vi.mock('@/lib/api/marketplace', () => ({
  getMarketplaceShifts: mocks.getMarketplaceShifts,
}));

vi.mock('@/lib/api/broadcast', () => ({
  getBroadcastHistory: mocks.getBroadcastHistory,
}));

const scheduleSummary = { startDate: '2026-01-01', numWeeks: 4, slotCount: 100, scenarioCount: 2, providerCount: 10 };
const shiftRequests = [{ id: 'req-1', status: 'pending' }];
const notifications = [{ id: 'n-1', channel: 'log' }];
const applyHistory = [{ applyId: 'a-1', rolloutMode: 'human_review' }];
const summary = { applyCount: 3, rollbackCount: 1 };
const capabilities = { provider: 'deterministic-fallback' };
const marketplaceShifts = [{ id: 'shift-1', status: 'POSTED' }];
const broadcastHistory = [{ entryId: 'e-1', tier: 1 }];

describe('useScheduleQueries', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    mocks.fetchScheduleSummary.mockResolvedValue(scheduleSummary);
    mocks.fetchScheduleScenarios.mockResolvedValue([]);
    mocks.fetchLastOptimizationResult.mockResolvedValue({ success: true, schedule: { providers: [], slots: [] } });
    mocks.fetchAgentTools.mockResolvedValue([]);
    mocks.listShiftRequests.mockResolvedValue(shiftRequests);
    mocks.listEmailEvents.mockResolvedValue([]);
    mocks.listNotificationHistory.mockResolvedValue(notifications);
    mocks.fetchApplyHistory.mockResolvedValue(applyHistory);
    mocks.fetchApplyHistorySummary.mockResolvedValue(summary);
    mocks.getCopilotCapabilities.mockResolvedValue(capabilities);
    mocks.getMarketplaceShifts.mockResolvedValue(marketplaceShifts);
    mocks.getBroadcastHistory.mockResolvedValue(broadcastHistory);
  });

  it('useScheduleSummaryQuery fetches schedule summary', async () => {
    const { result } = renderHook(() => useScheduleSummaryQuery(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(scheduleSummary));
    expect(mocks.fetchScheduleSummary).toHaveBeenCalledTimes(1);
  });

  it('useScheduleScenariosQuery fetches scenarios', async () => {
    const { result } = renderHook(() => useScheduleScenariosQuery(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(mocks.fetchScheduleScenarios).toHaveBeenCalledTimes(1);
  });

  it('useLastOptimizationResultQuery fetches last optimization result', async () => {
    const { result } = renderHook(() => useLastOptimizationResultQuery(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mocks.fetchLastOptimizationResult).toHaveBeenCalledTimes(1);
  });

  it('useAgentToolsQuery fetches agent tools', async () => {
    const { result } = renderHook(() => useAgentToolsQuery(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(mocks.fetchAgentTools).toHaveBeenCalledTimes(1);
  });

  it('useShiftRequestsQuery passes status filter and keys by status', async () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: ShiftRequestStatus }) => useShiftRequestsQuery(status),
      { wrapper, initialProps: { status: 'pending' } },
    );
    await waitFor(() => expect(result.current.data).toEqual(shiftRequests));
    expect(mocks.listShiftRequests).toHaveBeenCalledWith('pending');

    rerender({ status: 'approved' });
    await waitFor(() => expect(mocks.listShiftRequests).toHaveBeenCalledWith('approved'));

    const keys = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['shiftRequests'] })
      .map((q) => q.queryKey);
    expect(keys).toContainEqual(['shiftRequests', 'pending']);
    expect(keys).toContainEqual(['shiftRequests', 'approved']);
  });

  it('useEmailEventsQuery is disabled without requestId', async () => {
    const { result, rerender } = renderHook(
      ({ requestId }) => useEmailEventsQuery(requestId),
      { wrapper, initialProps: { requestId: '' } },
    );
    expect(result.current.data).toBeUndefined();
    expect(mocks.listEmailEvents).not.toHaveBeenCalled();

    rerender({ requestId: 'req-1' });
    await waitFor(() => expect(mocks.listEmailEvents).toHaveBeenCalledWith('req-1'));
  });

  it('useNotificationHistoryQuery defaults to limit 50', async () => {
    const { result } = renderHook(() => useNotificationHistoryQuery(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(notifications));
    expect(mocks.listNotificationHistory).toHaveBeenCalledWith(50);
  });

  it('useApplyHistoryQuery passes limit', async () => {
    const { result } = renderHook(() => useApplyHistoryQuery(10), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(applyHistory));
    expect(mocks.fetchApplyHistory).toHaveBeenCalledWith(10);
  });

  it('useApplyHistorySummaryQuery passes days', async () => {
    const { result } = renderHook(() => useApplyHistorySummaryQuery(7), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(summary));
    expect(mocks.fetchApplyHistorySummary).toHaveBeenCalledWith(7);
  });

  it('useCopilotCapabilitiesQuery fetches capabilities', async () => {
    const { result } = renderHook(() => useCopilotCapabilitiesQuery(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(capabilities));
    expect(mocks.getCopilotCapabilities).toHaveBeenCalledTimes(1);
  });

  it('useMarketplaceShiftsQuery passes filters', async () => {
    const filters = { status: 'POSTED' as const, postedByProviderId: 'p-1' };
    const { result } = renderHook(() => useMarketplaceShiftsQuery(filters), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(marketplaceShifts));
    expect(mocks.getMarketplaceShifts).toHaveBeenCalledWith(filters);
    const keys = queryClient.getQueryCache().findAll({ queryKey: ['marketplace'] });
    expect(keys).toHaveLength(1);
  });

  it('useBroadcastHistoryQuery is disabled without shiftId', async () => {
    const { result, rerender } = renderHook(
      ({ shiftId }) => useBroadcastHistoryQuery(shiftId),
      { wrapper, initialProps: { shiftId: '' } },
    );
    expect(result.current.data).toBeUndefined();
    expect(mocks.getBroadcastHistory).not.toHaveBeenCalled();

    rerender({ shiftId: 'shift-1' });
    await waitFor(() => expect(result.current.data).toEqual(broadcastHistory));
    expect(mocks.getBroadcastHistory).toHaveBeenCalledWith('shift-1');
  });
});
