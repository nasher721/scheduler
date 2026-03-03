const SUPPORTED_CHANNELS = ["log", "webhook", "slack", "teams", "email", "sms"];

const channelEnvConfig = {
  webhook: "NOTIFY_WEBHOOK_URL",
  slack: "NOTIFY_SLACK_WEBHOOK_URL",
  teams: "NOTIFY_TEAMS_WEBHOOK_URL",
  email: "NOTIFY_EMAIL_WEBHOOK_URL",
  sms: "NOTIFY_SMS_WEBHOOK_URL",
};

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getEnabledChannels() {
  return SUPPORTED_CHANNELS.filter((channel) => channel === "log" || Boolean(process.env[channelEnvConfig[channel]]));
}

function buildChannelPayload(notification, channel) {
  return {
    id: notification.id,
    channel,
    title: notification.title,
    body: notification.body,
    severity: notification.severity,
    eventType: notification.eventType,
    metadata: notification.metadata,
    createdAt: notification.createdAt,
  };
}

async function deliverToWebhook(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed with status ${response.status}.`);
  }
}

async function deliver(channel, payload) {
  if (channel === "log") {
    console.log(`[notification:${payload.severity}] ${payload.title} :: ${payload.body}`);
    return;
  }

  const envKey = channelEnvConfig[channel];
  const url = envKey ? process.env[envKey] : "";
  if (!url) {
    throw new Error(`Channel ${channel} is not configured.`);
  }

  await deliverToWebhook(url, payload);
}

export function listNotificationChannels() {
  return SUPPORTED_CHANNELS.map((channel) => ({
    id: channel,
    enabled: channel === "log" || Boolean(process.env[channelEnvConfig[channel]]),
    envKey: channelEnvConfig[channel] || null,
  }));
}

export async function dispatchNotification({ eventType, title, body, severity = "info", channels, metadata = {} }) {
  const enabled = getEnabledChannels();
  const requestedChannels = Array.isArray(channels) && channels.length > 0 ? channels : ["log"];
  const selectedChannels = requestedChannels.filter((channel) => SUPPORTED_CHANNELS.includes(channel));
  const dedupedChannels = [...new Set(selectedChannels.length > 0 ? selectedChannels : ["log"])];

  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    title,
    body,
    severity,
    channels: dedupedChannels,
    statusByChannel: {},
    metadata,
    createdAt: new Date().toISOString(),
  };

  for (const channel of dedupedChannels) {
    const payload = buildChannelPayload(notification, channel);
    if (!enabled.includes(channel) && channel !== "log") {
      notification.statusByChannel[channel] = "skipped_not_configured";
      continue;
    }

    try {
      await deliver(channel, payload);
      notification.statusByChannel[channel] = "sent";
    } catch (error) {
      notification.statusByChannel[channel] = `failed:${error?.message || "unknown_error"}`;
    }
  }

  return notification;
}

export function buildPendingApprovalAlerts(requests, now = Date.now(), alertWindowHours = 24) {
  const windowMs = toPositiveInt(alertWindowHours, 24) * 60 * 60 * 1000;

  return (Array.isArray(requests) ? requests : [])
    .filter((request) => request?.status === "pending" && typeof request?.deadlineAt === "string")
    .filter((request) => {
      const deadlineTs = Date.parse(request.deadlineAt);
      return Number.isFinite(deadlineTs) && deadlineTs - now <= windowMs;
    })
    .map((request) => ({
      eventType: "pending_approval_deadline",
      title: "Pending shift request requires review",
      body: `${request.providerName} ${request.type} request for ${request.date} is nearing its review deadline.`,
      severity: "warning",
      metadata: {
        requestId: request.id,
        deadlineAt: request.deadlineAt,
        providerName: request.providerName,
        requestType: request.type,
      },
      channels: ["log"],
    }));
}
