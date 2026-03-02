import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  History,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ServerCrash,
} from "lucide-react";
import { useScheduleStore } from "../store";
import {
  getAiRecommendations,
  runAiOptimize,
  detectAiConflicts,
  applyAiResult,
  rollbackAiApply,
  getAiApplyHistory,
  type AiRecommendation,
  type AiConflict,
  type AiOptimizeResult,
  type ApplyHistoryRecord,
  type PersistedScheduleState,
} from "../lib/api";

type Tab = "recommend" | "optimize" | "conflicts" | "history";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-rose-600 bg-rose-50 border-rose-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-slate-500 bg-slate-50 border-slate-200",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-rose-600 bg-rose-50 border-rose-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-slate-500 bg-slate-50 border-slate-200",
};

function TabButton({ id, active, label, icon, onClick }: {
  id: Tab; active: boolean; label: string; icon: React.ReactNode; onClick: (id: Tab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${active ? "bg-white text-primary shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <ServerCrash className="w-10 h-10 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Recommendations Tab
// ──────────────────────────────────────────────────────────────────────────────
function RecommendationsTab({ statePayload }: { statePayload: PersistedScheduleState }) {
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useScheduleStore();

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { result } = await getAiRecommendations(statePayload);
      setRecommendations(result.recommendations ?? []);
      setSource(result.source ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast({ type: "error", title: "AI Error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [statePayload, showToast]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif text-slate-900">AI Recommendations</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            Ranked improvement suggestions for the current schedule
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleFetch}
          disabled={loading}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? "Analyzing…" : "Get Recommendations"}
        </motion.button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {source && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Source: <span className="text-slate-600">{source}</span>
        </p>
      )}

      <AnimatePresence>
        {recommendations.length === 0 && !loading && !error && (
          <EmptyState message="Click 'Get Recommendations' to analyse the current schedule." />
        )}
        <div className="flex flex-col gap-3">
          {recommendations.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-2xl border border-slate-200/60 bg-white/60 hover:bg-white hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
                <div className="flex gap-2 shrink-0">
                  <Badge label={rec.priority} colorClass={PRIORITY_COLOR[rec.priority] ?? PRIORITY_COLOR.low} />
                  <Badge label={rec.type} colorClass="text-primary bg-primary/5 border-primary/10" />
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>
              {rec.impact && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">
                  Impact: <span className="text-slate-600 font-medium normal-case tracking-normal">{rec.impact}</span>
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Optimize Tab
// ──────────────────────────────────────────────────────────────────────────────
function OptimizeTab({ statePayload }: { statePayload: PersistedScheduleState }) {
  const [result, setResult] = useState<AiOptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [approverName, setApproverName] = useState("");
  const { showToast, loadState } = useScheduleStore();

  const handleOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { result: r } = await runAiOptimize(statePayload);
      setResult(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast({ type: "error", title: "Optimization Error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [statePayload, showToast]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    const mode = result.rollout?.mode ?? "shadow";
    if (mode === "shadow") {
      showToast({ type: "warning", title: "Shadow Mode", message: "This result is in shadow mode and cannot be applied." });
      return;
    }
    if (mode === "human_review" && !approverName.trim()) {
      showToast({ type: "warning", title: "Approver Required", message: "Enter your name in the Approver field before applying." });
      return;
    }
    setApplying(true);
    try {
      const { state: nextState } = await applyAiResult({ result, approvedBy: approverName.trim() || undefined });
      loadState(nextState as Parameters<typeof loadState>[0]);
      showToast({ type: "success", title: "Schedule Applied", message: "The optimized schedule has been applied and saved to the server." });
      setResult(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      showToast({ type: "error", title: "Apply Failed", message: msg });
    } finally {
      setApplying(false);
    }
  }, [result, approverName, showToast, loadState]);

  const rolloutMode = result?.rollout?.mode ?? "";
  const canApply = rolloutMode === "auto_apply" || rolloutMode === "human_review";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif text-slate-900">AI Schedule Optimizer</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            Generate an optimized schedule candidate with constraint guardrails
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOptimize}
          disabled={loading}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
          {loading ? "Optimizing…" : "Run Optimizer"}
        </motion.button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!result && !loading && !error && (
        <EmptyState message="Click 'Run Optimizer' to generate an optimized schedule candidate." />
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          {/* Score Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Objective Score", value: result.objectiveScore?.toFixed(2) ?? "—" },
              { label: "Confidence", value: result.rollout?.confidenceScore != null ? `${(result.rollout.confidenceScore * 100).toFixed(0)}%` : "—" },
              { label: "Hard Violations", value: String(result.guardrails?.hardViolationCount ?? 0) },
              { label: "Changes", value: String(result.changes?.length ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="stone-panel p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Rollout Mode */}
          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200/60 bg-white/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rollout Mode:</span>
            <Badge
              label={rolloutMode}
              colorClass={
                rolloutMode === "auto_apply" ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
                rolloutMode === "human_review" ? "text-amber-600 bg-amber-50 border-amber-200" :
                "text-slate-500 bg-slate-50 border-slate-200"
              }
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Source:</span>
            <span className="text-[10px] font-medium text-slate-600">{result.source}</span>
          </div>

          {/* Explanation */}
          {result.explanation && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Optimizer Explanation</p>
              <p className="text-sm text-slate-700 leading-relaxed">{result.explanation}</p>
            </div>
          )}

          {/* Changes Accordion */}
          {(result.changes?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-slate-200/60 overflow-hidden">
              <button
                onClick={() => setChangesOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {result.changes.length} Proposed Changes
                </span>
                {changesOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              <AnimatePresence>
                {changesOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {result.changes.map((change, i) => (
                        <div key={i} className="px-5 py-3 flex items-start gap-3 text-xs">
                          <span className="font-mono text-slate-400 shrink-0">{change.slotId}</span>
                          <span className="text-slate-600 flex-1">{change.reason}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Apply Controls */}
          {canApply && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200/60 bg-white/60">
              {rolloutMode === "human_review" && (
                <input
                  type="text"
                  placeholder="Your name (required for approval)"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="flex-1 bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApply}
                disabled={applying}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {applying ? "Applying…" : "Apply Schedule"}
              </motion.button>
            </div>
          )}

          {rolloutMode === "shadow" && (
            <p className="text-xs text-slate-500 italic">
              Shadow mode: results are for review only and cannot be applied automatically.
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Conflicts Tab
// ──────────────────────────────────────────────────────────────────────────────
function ConflictsTab({ statePayload }: { statePayload: PersistedScheduleState }) {
  const [conflicts, setConflicts] = useState<AiConflict[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useScheduleStore();

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { result } = await detectAiConflicts(statePayload);
      setConflicts(result.conflicts ?? []);
      setSource(result.source ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast({ type: "error", title: "Conflict Detection Error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [statePayload, showToast]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif text-slate-900">Conflict Detection</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            Machine-readable violations and severity analysis
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleFetch}
          disabled={loading}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {loading ? "Scanning…" : "Detect Conflicts"}
        </motion.button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {source && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Source: <span className="text-slate-600">{source}</span>
        </p>
      )}

      {!loading && !error && conflicts.length === 0 && (
        <EmptyState message="Click 'Detect Conflicts' to scan the current schedule." />
      )}

      {conflicts.length > 0 && (
        <AnimatePresence>
          {conflicts.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-2xl border bg-white/60 hover:bg-white hover:shadow-sm transition-all"
              style={{ borderColor: c.severity === "critical" ? "#fca5a5" : c.severity === "high" ? "#fdba74" : "#e2e8f0" }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-semibold text-slate-800">{c.description}</p>
                <div className="flex gap-2 shrink-0">
                  <Badge label={c.severity} colorClass={SEVERITY_COLOR[c.severity] ?? SEVERITY_COLOR.low} />
                  <Badge label={c.type} colorClass="text-primary bg-primary/5 border-primary/10" />
                </div>
              </div>
              {c.suggestedFix && (
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{c.suggestedFix}</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Apply History Tab
// ──────────────────────────────────────────────────────────────────────────────
function ApplyHistoryTab() {
  const [records, setRecords] = useState<ApplyHistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast, loadState } = useScheduleStore();

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { records: r, total: t } = await getAiApplyHistory({ limit: 50 });
      setRecords(r);
      setTotal(t);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast({ type: "error", title: "History Load Error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleRollback = useCallback(async (applyId: string) => {
    const reviewer = window.prompt("Enter your name to confirm rollback:");
    if (!reviewer?.trim()) return;
    setRollingBack(applyId);
    try {
      const { state: restoredState } = await rollbackAiApply({ applyId, rolledBackBy: reviewer.trim() });
      loadState(restoredState as Parameters<typeof loadState>[0]);
      showToast({ type: "info", title: "Rolled Back", message: `Apply ${applyId} has been rolled back.` });
      await handleFetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      showToast({ type: "error", title: "Rollback Failed", message: msg });
    } finally {
      setRollingBack(null);
    }
  }, [showToast, loadState, handleFetch]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif text-slate-900">Apply History</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            Audit trail of AI-applied schedules with rollback controls
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleFetch}
          disabled={loading}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
          {loading ? "Loading…" : "Load History"}
        </motion.button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {total > 0 && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Showing {records.length} of {total} total records
        </p>
      )}

      {records.length === 0 && !loading && !error && (
        <EmptyState message="Click 'Load History' to view past AI apply events." />
      )}

      <div className="flex flex-col gap-3">
        {records.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`p-5 rounded-2xl border transition-all ${rec.rolledBackAt ? "bg-slate-50 border-slate-200/60 opacity-60" : "bg-white/60 border-slate-200/60 hover:bg-white hover:shadow-sm"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-slate-400">{rec.id}</span>
                  {rec.rolloutMode && (
                    <Badge
                      label={rec.rolloutMode}
                      colorClass={rec.rolloutMode === "auto_apply" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-600 bg-amber-50 border-amber-200"}
                    />
                  )}
                  {rec.rolledBackAt && <Badge label="Rolled Back" colorClass="text-slate-500 bg-slate-100 border-slate-200" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(rec.timestamp).toLocaleString()} {rec.approvedBy ? `· Approved by ${rec.approvedBy}` : ""}
                </p>
                <div className="flex gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {rec.objectiveScore != null && <span>Score: <span className="text-slate-600">{rec.objectiveScore.toFixed(2)}</span></span>}
                  {rec.confidenceScore != null && <span>Confidence: <span className="text-slate-600">{(rec.confidenceScore * 100).toFixed(0)}%</span></span>}
                  {rec.hardViolationCount != null && <span>Violations: <span className={rec.hardViolationCount > 0 ? "text-rose-600" : "text-emerald-600"}>{rec.hardViolationCount}</span></span>}
                  <span>Changes: <span className="text-slate-600">{rec.changeCount}</span></span>
                </div>
                {rec.rolledBackAt && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Rolled back {new Date(rec.rolledBackAt).toLocaleString()} by {rec.rolledBackBy}
                    {rec.rollbackReason ? ` · ${rec.rollbackReason}` : ""}
                  </p>
                )}
              </div>

              {!rec.rolledBackAt && (
                <button
                  onClick={() => handleRollback(rec.id)}
                  disabled={rollingBack === rec.id}
                  title="Rollback this apply"
                  className="shrink-0 p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all disabled:opacity-50"
                >
                  {rollingBack === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Root Panel
// ──────────────────────────────────────────────────────────────────────────────
export function AiAssistPanel() {
  const [tab, setTab] = useState<Tab>("recommend");
  const { providers, slots, startDate, numWeeks, customRules, auditLog, scenarios } = useScheduleStore();

  const statePayload: PersistedScheduleState = {
    providers,
    slots,
    startDate,
    numWeeks,
    customRules,
    auditLog,
    scenarios,
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Panel Header */}
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-serif text-slate-900 tracking-tight">AI Assist</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-0.5">
              Provider-agnostic AI scheduling intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="satin-panel p-1.5 flex items-center gap-1.5 w-fit border-slate-200/50">
        <TabButton id="recommend" active={tab === "recommend"} label="Recommendations" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={setTab} />
        <TabButton id="optimize" active={tab === "optimize"} label="Optimize" icon={<BrainCircuit className="w-3.5 h-3.5" />} onClick={setTab} />
        <TabButton id="conflicts" active={tab === "conflicts"} label="Conflicts" icon={<ShieldCheck className="w-3.5 h-3.5" />} onClick={setTab} />
        <TabButton id="history" active={tab === "history"} label="Apply History" icon={<History className="w-3.5 h-3.5" />} onClick={setTab} />
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "recommend" && <RecommendationsTab statePayload={statePayload} />}
          {tab === "optimize" && <OptimizeTab statePayload={statePayload} />}
          {tab === "conflicts" && <ConflictsTab statePayload={statePayload} />}
          {tab === "history" && <ApplyHistoryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
