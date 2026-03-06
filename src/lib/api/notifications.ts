/**
 * Notifications API
 * Notification management and history
 */

import { supabase } from "../supabase";
import { requestJson } from "./client";
import {
  type NotificationRecord,
  type NotificationSeverity,
} from "../../types";

export async function sendNotification(payload: {
  title: string;
  body: string;
  severity?: NotificationSeverity;
  eventType?: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
}): Promise<{ notification: NotificationRecord }> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      title: payload.title,
      body: payload.body,
      severity: payload.severity || "info",
      event_type: payload.eventType,
      channels: payload.channels || [],
      metadata: payload.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }

  return {
    notification: {
      id: data.id,
      eventType: data.event_type,
      title: data.title,
      body: data.body,
      severity: data.severity as NotificationSeverity,
      channels: data.channels as string[],
      statusByChannel: data.status_by_channel as Record<string, string>,
      metadata: data.metadata as Record<string, unknown>,
      createdAt: data.created_at,
    } as NotificationRecord
  };
}

export async function listNotificationHistory(limit = 50): Promise<{ records: NotificationRecord[]; total: number }> {
  const { data, error, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load notification history: ${error.message}`);
  }

  return {
    records: (data || []).map((d) => ({
      id: d.id,
      eventType: d.event_type,
      title: d.title,
      body: d.body,
      severity: d.severity as NotificationSeverity,
      channels: d.channels as string[],
      statusByChannel: d.status_by_channel as Record<string, string>,
      metadata: d.metadata as Record<string, unknown>,
      createdAt: d.created_at,
    })) as NotificationRecord[],
    total: count || 0
  };
}

export async function updateNotification(
  id: string,
  payload: {
    title?: string;
    body?: string;
    severity?: NotificationSeverity;
    channels?: string[];
    statusByChannel?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }
): Promise<{ notification: NotificationRecord; updatedAt: string }> {
  return requestJson<{ notification: NotificationRecord; updatedAt: string }>(
    `/api/notifications/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Update notification"
  );
}

export async function deleteNotification(id: string): Promise<{ ok: boolean; deletedId: string; updatedAt: string }> {
  return requestJson<{ ok: boolean; deletedId: string; updatedAt: string }>(
    `/api/notifications/${id}`,
    {
      method: "DELETE",
    },
    "Delete notification"
  );
}
