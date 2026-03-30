import { MarketplaceShift, ShiftLifecycleStatus } from '@/types';
import { API_BASE } from './client';

export async function getMarketplaceShifts(filters?: {
  status?: ShiftLifecycleStatus;
  postedByProviderId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ shifts: MarketplaceShift[] }> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.postedByProviderId) params.append('postedByProviderId', filters.postedByProviderId);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  
  const res = await fetch(`${API_BASE}/api/marketplace/shifts?${params}`);
  if (!res.ok) throw new Error('Failed to fetch marketplace shifts');
  return res.json();
}

export async function postShiftForCoverage(
  slotId: string, 
  postedByProviderId: string, 
  notes?: string
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/marketplace/shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotId, postedByProviderId, notes }),
  });
  if (!res.ok) throw new Error('Failed to post shift');
  return res.json();
}

export async function claimShift(shiftId: string, providerId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/marketplace/shifts/${shiftId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId }),
  });
  if (!res.ok) throw new Error('Failed to claim shift');
}

export async function approveShift(shiftId: string, approvedBy: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/marketplace/shifts/${shiftId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedBy }),
  });
  if (!res.ok) throw new Error('Failed to approve shift');
}

export async function cancelMarketplaceShift(shiftId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/marketplace/shifts/${shiftId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to cancel shift');
}

export async function getMyShifts(): Promise<{ posted: MarketplaceShift[]; claimed: MarketplaceShift[] }> {
  const res = await fetch(`${API_BASE}/api/marketplace/my-shifts`);
  if (!res.ok) throw new Error('Failed to fetch my shifts');
  return res.json();
}
