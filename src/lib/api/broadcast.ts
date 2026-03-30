import { BroadcastHistoryEntry, BroadcastChannel } from '@/types';
import { API_BASE } from './client';

export async function dispatchBroadcast(
  shiftId: string,
  channel: BroadcastChannel,
  eligibleProviderIds: string[]
): Promise<{ entryId: string; recipients: number; status: string }> {
  const res = await fetch(`${API_BASE}/api/broadcast/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shiftId, channel, eligibleProviderIds }),
  });
  if (!res.ok) throw new Error('Failed to dispatch broadcast');
  return res.json();
}

export async function escalateBroadcast(
  shiftId: string,
  currentTier: number
): Promise<{ entryId: string; tier: number; recipients: number }> {
  const res = await fetch(`${API_BASE}/api/broadcast/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shiftId, currentTier }),
  });
  if (!res.ok) throw new Error('Failed to escalate broadcast');
  return res.json();
}

export async function getBroadcastHistory(shiftId: string): Promise<{ entries: BroadcastHistoryEntry[] }> {
  const res = await fetch(`${API_BASE}/api/broadcast/history?shiftId=${shiftId}`);
  if (!res.ok) throw new Error('Failed to fetch broadcast history');
  return res.json();
}

export async function updateBroadcastRecipientStatus(
  entryId: string,
  providerId: string,
  status: 'sent' | 'delivered' | 'failed'
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/broadcast/recipients/${entryId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, status }),
  });
  if (!res.ok) throw new Error('Failed to update recipient status');
}
