import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type ShiftSlot } from "../store";
import { format, parseISO, differenceInDays } from "date-fns";
import { 
  AlertTriangle, 
  AlertCircle,
  Info,
  X,
  Check,
  Calendar,
  ChevronDown,
  Filter,
  Bell,
  ExternalLink,
  RotateCcw
} from "lucide-react";

interface CoverageAlertDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  date?: string;
  providerId?: string;
  slotId?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function CoverageAlertDashboard({ isOpen, onClose }: CoverageAlertDashboardProps) {
  const { 
    conflicts, 
    slots, 
    providers, 
    resolveConflict,
    ignoreConflict,
    detectConflicts 
  } = useScheduleStore();
  
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [_showAcknowledged, _setShowAcknowledged] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // Generate alerts from conflicts and other sources
  const alerts = useMemo((): Alert[] => {
    const allAlerts: Alert[] = [];

    // Add conflicts as alerts
    conflicts.forEach((conflict) => {
      allAlerts.push({
        id: conflict.id,
        type: conflict.type,
        severity: conflict.severity,
        title: conflict.title,
        description: conflict.description,
        providerId: conflict.providerId,
        slotId: conflict.slotId,
        action: conflict.suggestedActions[0] ? {
          label: conflict.suggestedActions[0].label,
          onClick: () => resolveConflict(conflict.id, conflict.suggestedActions[0].id)
        } : undefined
      });
    });

    // Add unfilled critical shifts
    const unfilledCritical = slots.filter(s => 
      s.servicePriority === 'CRITICAL' && !s.providerId
    );
    
    // Group by date for cleaner display
    const criticalByDate = new Map<string, ShiftSlot[]>();
    unfilledCritical.forEach(slot => {
      const existing = criticalByDate.get(slot.date) || [];
      existing.push(slot);
      criticalByDate.set(slot.date, existing);
    });

    criticalByDate.forEach((slots, date) => {
      allAlerts.push({
        id: `unfilled-critical-${date}`,
        type: 'UNFILLED_CRITICAL',
        severity: 'CRITICAL',
        title: `${slots.length} Critical Shift${slots.length > 1 ? 's' : ''} Unfilled`,
        description: slots.map(s => s.serviceLocation).join(', '),
        date,
        action: {
          label: 'Auto-assign',
          onClick: () => {
            // Could trigger auto-assign for specific slots
            detectConflicts();
          }
        }
      });
    });

    // Add credential expiration alerts
    providers.forEach(provider => {
      provider.credentials?.forEach(cred => {
        if (cred.expiresAt) {
          const daysUntil = differenceInDays(parseISO(cred.expiresAt), new Date());
          
          if (daysUntil < 0) {
            allAlerts.push({
              id: `cred-expired-${provider.id}-${cred.credentialType}`,
              type: 'CREDENTIAL_EXPIRED',
              severity: 'CRITICAL',
              title: `${provider.name}'s ${cred.credentialType} Expired`,
              description: `Expired on ${format(parseISO(cred.expiresAt), "MMM d, yyyy")}. Provider cannot be assigned until renewed.`,
              providerId: provider.id,
            });
          } else if (daysUntil <= 30) {
            allAlerts.push({
              id: `cred-expiring-${provider.id}-${cred.credentialType}`,
              type: 'CREDENTIAL_EXPIRING',
              severity: daysUntil <= 7 ? 'CRITICAL' : 'WARNING',
              title: `${provider.name}'s ${cred.credentialType} Expiring`,
              description: `Expires in ${daysUntil} days (${format(parseISO(cred.expiresAt), "MMM d, yyyy")}).`,
              providerId: provider.id,
            });
          }
        }
      });
    });

    return allAlerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [conflicts, slots, providers, detectConflicts, resolveConflict]);

  const filteredAlerts = useMemo(() => {
    if (filterSeverity === 'all') return alerts;
    return alerts.filter(a => a.severity === filterSeverity);
  }, [alerts, filterSeverity]);

  const stats = useMemo(() => ({
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    warning: alerts.filter(a => a.severity === 'WARNING').length,
    info: alerts.filter(a => a.severity === 'INFO').length,
    total: alerts.length
  }), [alerts]);

  const toggleExpand = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      case 'WARNING':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'INFO':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'WARNING':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'INFO':
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-rose-50 to-amber-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm">
                    <Bell className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Coverage Alerts</h2>
                    <p className="text-sm text-slate-600">
                      {stats.critical} critical, {stats.warning} warnings, {stats.info} info
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => detectConflicts()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Refresh
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="p-3 bg-white rounded-xl border border-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-medium text-rose-700">Critical</span>
                  </div>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{stats.critical}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">Warnings</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{stats.warning}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700">Info</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{stats.info}</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as AlertSeverity | 'all')}
                className="bg-transparent border-none text-sm text-slate-700 focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="WARNING">Warnings Only</option>
                <option value="INFO">Info Only</option>
              </select>
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {filteredAlerts.map((alert) => {
                  const isExpanded = expandedAlerts.has(alert.id);
                  
                  return (
                    <motion.div
                      key={alert.id}
                      layout
                      className={`rounded-xl border ${getSeverityColor(alert.severity)} overflow-hidden`}
                    >
                      <button
                        onClick={() => toggleExpand(alert.id)}
                        className="w-full p-4 flex items-start gap-3 text-left"
                      >
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{alert.title}</h3>
                            <ChevronDown 
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            />
                          </div>
                          <p className="text-sm opacity-80 mt-1">{alert.description}</p>
                          {alert.date && (
                            <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(alert.date), "MMMM d, yyyy")}
                            </div>
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-current border-opacity-20"
                          >
                            <div className="p-4 pt-2">
                              <div className="flex items-center gap-2">
                                {alert.action && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      alert.action?.onClick();
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-sm font-medium hover:bg-opacity-80 transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    {alert.action.label}
                                  </button>
                                )}
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    ignoreConflict(alert.id);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 rounded-lg text-sm font-medium hover:bg-white transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Dismiss
                                </button>

                                {alert.slotId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Navigate to slot
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 rounded-lg text-sm font-medium hover:bg-white transition-colors ml-auto"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Shift
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {filteredAlerts.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">All Clear!</h3>
                    <p className="text-slate-500 mt-1">No coverage issues detected</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Mini alert badge for showing in the main calendar
export function AlertBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
      <AlertTriangle className="w-3 h-3" />
      {count}
    </span>
  );
}
