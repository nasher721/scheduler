import { useEffect, useMemo, useState } from "react";
import {
  createShiftRequest,
  listShiftRequests,
  reviewShiftRequest,
  type ShiftRequest,
  type ShiftRequestStatus,
  type ShiftRequestType,
} from "../lib/api";
import { useScheduleStore } from "../store";

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

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);

  const loadRequests = async (nextStatus = statusFilter) => {
    try {
      setIsLoading(true);
      const response = await listShiftRequests(nextStatus === "all" ? undefined : nextStatus);
      setRequests(response.requests);
    } catch {
      showToast({ type: "error", title: "Request sync failed", message: "Could not load shift requests from API." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!providerName || !date) {
      showToast({ type: "warning", title: "Missing fields", message: "Provider and date are required." });
      return;
    }

    try {
      await createShiftRequest({ providerName, date, type, notes });
      showToast({ type: "success", title: "Request submitted", message: "Shift request was sent for review." });
      setNotes("");
      await loadRequests();
    } catch {
      showToast({ type: "error", title: "Submit failed", message: "Could not submit shift request." });
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

  return (
    <section className="stone-panel p-6 flex flex-col gap-5 no-print">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Shift Request Inbox</h2>
          <p className="text-xs text-slate-500">Workflow for team requests persisted in the backend API.</p>
        </div>
        <div className="text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200">
          Pending: <span className="font-semibold">{pendingCount}</span>
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
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  Loading requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  No requests found for this filter.
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{request.providerName}</td>
                  <td className="px-3 py-2">{request.date}</td>
                  <td className="px-3 py-2">{REQUEST_TYPE_LABELS[request.type]}</td>
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
                      </div>
                    ) : (
                      <span className="text-slate-400">Reviewed</span>
                    )}
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
