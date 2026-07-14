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
  shiftId: string
): Promise<{ entryId: string; tier: number; recipients: number }> {
  const res = await fetch(`${API_BASE}/api/broadcast/escalate/${shiftId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to escalate broadcast');
  return res.json();
}

export async function getBroadcastHistory(shiftId: string): Promise<{ entries: BroadcastHistoryEntry[] }> {
  const res = await fetch(`${API_BASE}/api/broadcast/history?shiftId=${shiftId}`);
  if (!res.ok) throw new Error('Failed to fetch broadcast history');
  return res.json();
}
