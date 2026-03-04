import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createShiftRequest,
  deleteEmailEvent,
  deleteShiftRequest,
  listEmailEvents,
  listShiftRequests,
  reviewShiftRequest,
  submitInboundEmail,
  updateEmailEvent,
  type EmailEvent,
  type ShiftRequest,
  type ShiftRequestStatus,
  type ShiftRequestType,
} from "../lib/api";
import { useScheduleStore } from "../store";
import { supabase } from "../lib/supabase";

const REQUEST_TYPE_LABELS: Record<ShiftRequestType, string> = {
  time_off: "Time Off",
  swap: "Shift Swap",
  availability: "Availability Update",
};

const STATUS_OPTIONS: Array<{ value: ShiftRequestStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

export function ShiftRequestBoard() {
  const showToast = useScheduleStore((state) => state.showToast);
  const providers = useScheduleStore((state) => state.providers);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ShiftRequestStatus | "all">("all");
  const [providerName, setProviderName] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<ShiftRequestType>("time_off");
  const [notes, setNotes] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailSubject, setEmailSubject] = useState("Schedule change request");
  const [emailBody, setEmailBody] = useState("date: \ntype: time_off\nnotes: ");
  const [emailEventCount, setEmailEventCount] = useState(0);
  const [emailEvents, setEmailEvents] = useState<EmailEvent[]>([]);

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);

  const loadRequests = useCallback(async (nextStatus = statusFilter) => {
    try {
      setIsLoading(true);
      const response = await listShiftRequests(nextStatus === "all" ? undefined : nextStatus);
      setRequests(response.requests);
    } catch {
      showToast({ type: "error", title: "Request sync failed", message: "Could not load shift requests from API." });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, statusFilter]);

  const loadEmailEvents = useCallback(async () => {
    try {
      const response = await listEmailEvents();
      setEmailEvents(response.events);
      setEmailEventCount(response.events.length);
    } catch {
      showToast({ type: "error", title: "Email events sync failed", message: "Could not load email workflow events." });
    }
  }, [showToast]);

  useEffect(() => {
    void loadRequests();
    void loadEmailEvents();
  }, [loadRequests, loadEmailEvents]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadRequests(statusFilter);
      void loadEmailEvents();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadRequests, loadEmailEvents, statusFilter]);

  useEffect(() => {
    const channel = supabase
      .channel("shift-request-board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_requests" }, () => {
        void loadRequests(statusFilter);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "email_events" }, () => {
        void loadEmailEvents();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRequests, loadEmailEvents, statusFilter]);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!providerName || !date) {
      showToast({ type: "warning", title: "Missing fields", message: "Provider and date are required." });
      return;
    }

    try {
      await createShiftRequest({ providerName, date, type, notes, source: "app" });
      showToast({ type: "success", title: "Request submitted", message: "Shift request was sent for review." });
      setNotes("");
      await loadRequests();
    } catch {
      showToast({ type: "error", title: "Submit failed", message: "Could not submit shift request." });
    }
  };

  const submitInboundRequestEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailFrom.trim() || !emailSubject.trim()) {
      showToast({ type: "warning", title: "Missing email metadata", message: "Sender and subject are required." });
      return;
    }

    try {
      await submitInboundEmail({ from: emailFrom, subject: emailSubject, body: emailBody });
      await loadRequests();
      await loadEmailEvents();
      showToast({ type: "success", title: "Email triaged", message: "Inbound email was converted to a pending request." });
    } catch {
      showToast({ type: "error", title: "Email triage failed", message: "Could not process inbound email into triage board." });
    }
  };

  const updateEventStatus = async (eventId: string, status: string) => {
    try {
      await updateEmailEvent(eventId, { status });
      await loadEmailEvents();
      showToast({ type: "success", title: "Event updated", message: `Email event marked as ${status}.` });
    } catch {
      showToast({ type: "error", title: "Update failed", message: "Could not update email event." });
    }
  };

  const removeEmailEvent = async (eventId: string) => {
    try {
      await deleteEmailEvent(eventId);
      await loadEmailEvents();
      showToast({ type: "info", title: "Event deleted", message: "Email event removed." });
    } catch {
      showToast({ type: "error", title: "Delete failed", message: "Could not delete email event." });
    }
  };

  const reviewRequest = async (requestId: string, nextStatus: "approved" | "denied") => {
    try {
      await reviewShiftRequest(requestId, { status: nextStatus, reviewedBy: "scheduler-admin" });
      await loadRequests();
      showToast({
        type: "success",
        title: `Request ${nextStatus}`,
        message: `The request has been marked as ${nextStatus}.`,
      });
    } catch {
      showToast({ type: "error", title: "Review failed", message: "Could not update request status." });
    }
  };

  const removeRequest = async (requestId: string) => {
    try {
      await deleteShiftRequest(requestId);
      await loadRequests();
      showToast({
        type: "info",
        title: "Request deleted",
        message: "The shift request was removed.",
      });
    } catch {
      showToast({ type: "error", title: "Delete failed", message: "Could not delete request." });
    }
  };

  return (
    <section className="stone-panel p-6 flex flex-col gap-5 no-print">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Shift Request Inbox</h2>
          <p className="text-xs text-slate-500">Workflow for team requests persisted in the backend API.</p>
        </div>
        <div className="text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200">
          Pending: <span className="font-semibold">{pendingCount}</span> · Email events: <span className="font-semibold">{emailEventCount}</span>
        </div>
      </div>

      <form onSubmit={submitRequest} className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
        <label className="text-xs text-slate-600 flex flex-col gap-1">
          Provider
          <select
            value={providerName}
            onChange={(event) => setProviderName(event.target.value)}
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Select provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.name}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-600 flex flex-col gap-1">
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="border rounded-lg px-3 py-2 bg-white" />
        </label>

        <label className="text-xs text-slate-600 flex flex-col gap-1">
          Request Type
          <select value={type} onChange={(event) => setType(event.target.value as ShiftRequestType)} className="border rounded-lg px-3 py-2 bg-white">
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-600 flex flex-col gap-1 lg:col-span-2">
          Notes
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context"
            className="border rounded-lg px-3 py-2 bg-white"
          />
        </label>

        <button type="submit" className="lg:col-span-5 justify-self-end px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">
          Submit Request
        </button>
      </form>


      <form onSubmit={submitInboundRequestEmail} className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-end border border-slate-200 rounded-xl p-3 bg-slate-50">
        <p className="lg:col-span-6 text-xs text-slate-600">Triage inbound provider emails into pending requests (auto-refreshes every 15s).</p>
        <label className="text-xs text-slate-600 flex flex-col gap-1 lg:col-span-2">
          From
          <input type="email" value={emailFrom} onChange={(event) => setEmailFrom(event.target.value)} className="border rounded-lg px-3 py-2 bg-white" placeholder="physician@hospital.org" />
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1 lg:col-span-2">
          Subject
          <input type="text" value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} className="border rounded-lg px-3 py-2 bg-white" />
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1 lg:col-span-2">
          Body
          <input type="text" value={emailBody} onChange={(event) => setEmailBody(event.target.value)} className="border rounded-lg px-3 py-2 bg-white" />
        </label>
        <button type="submit" className="lg:col-span-6 justify-self-end px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold">
          Triage Inbound Email
        </button>
      </form>

      <div className="flex justify-end">
        <label className="text-xs text-slate-600 flex items-center gap-2">
          Filter
          <select
            value={statusFilter}
            onChange={async (event) => {
              const nextStatus = event.target.value as ShiftRequestStatus | "all";
              setStatusFilter(nextStatus);
              await loadRequests(nextStatus);
            }}
            className="border rounded-lg px-2 py-1 bg-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                  Loading requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                  No requests found for this filter.
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{request.providerName}</td>
                  <td className="px-3 py-2">{request.date}</td>
                  <td className="px-3 py-2">{REQUEST_TYPE_LABELS[request.type]}</td>
                  <td className="px-3 py-2 uppercase text-[10px]">{request.source || "app"}</td>
                  <td className="px-3 py-2 capitalize">{request.status}</td>
                  <td className="px-3 py-2">
                    {request.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, "approved")}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewRequest(request.id, "denied")}
                          className="px-2 py-1 rounded bg-rose-50 text-rose-700"
                        >
                          Deny
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRequest(request.id)}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <span className="text-slate-400">Reviewed</span>
                        <button
                          type="button"
                          onClick={() => removeRequest(request.id)}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="px-3 py-2 bg-slate-50 text-slate-500 uppercase tracking-wider text-xs font-semibold">
          Recent Email Events
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emailEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                  No email events yet.
                </td>
              </tr>
            ) : (
              emailEvents.slice(0, 8).map((event) => (
                <tr key={event.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{event.type}</td>
                  <td className="px-3 py-2">{event.status}</td>
                  <td className="px-3 py-2">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateEventStatus(event.id, "sent")}
                        className="px-2 py-1 rounded bg-emerald-50 text-emerald-700"
                      >
                        Mark Sent
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEmailEvent(event.id)}
                        className="px-2 py-1 rounded bg-slate-100 text-slate-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
