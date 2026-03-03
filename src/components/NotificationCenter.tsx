import { useState } from "react";
import { useScheduleStore, type Notification, type NotificationType } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  Check, 
  Settings,
  ChevronRight,
  Calendar,
  ArrowRightLeft,
  AlertTriangle,
  Award
} from "lucide-react";
import { format, parseISO } from "date-fns";

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  SHIFT_REMINDER: <Calendar className="w-4 h-4" />,
  SWAP_REQUEST: <ArrowRightLeft className="w-4 h-4" />,
  SWAP_APPROVED: <Check className="w-4 h-4" />,
  SCHEDULE_CHANGE: <Bell className="w-4 h-4" />,
  CONFLICT_DETECTED: <AlertTriangle className="w-4 h-4" />,
  CREDENTIAL_EXPIRING: <Award className="w-4 h-4" />,
  TIME_OFF_APPROVED: <Check className="w-4 h-4" />,
};

const notificationColors: Record<NotificationType, string> = {
  SHIFT_REMINDER: "bg-primary/10 text-primary",
  SWAP_REQUEST: "bg-warning/10 text-warning",
  SWAP_APPROVED: "bg-success/10 text-success",
  SCHEDULE_CHANGE: "bg-slate-100 text-slate-600",
  CONFLICT_DETECTED: "bg-error/10 text-error",
  CREDENTIAL_EXPIRING: "bg-warning/10 text-warning",
  TIME_OFF_APPROVED: "bg-success/10 text-success",
};

function NotificationCard({ notification }: { notification: Notification }) {
  const { markNotificationRead } = useScheduleStore();
  const isUnread = !notification.readAt;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={() => isUnread && markNotificationRead(notification.id)}
      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
        isUnread 
          ? "bg-white border-slate-200 shadow-sm" 
          : "bg-slate-50/50 border-slate-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${notificationColors[notification.type]}`}>
          {notificationIcons[notification.type]}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm ${isUnread ? "font-bold text-slate-800" : "font-medium text-slate-600"}`}>
              {notification.title}
            </h4>
            {isUnread && (
              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            )}
          </div>
          
          <p className="text-xs text-slate-500 mt-1">{notification.message}</p>
          
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-slate-400">
              {format(parseISO(notification.createdAt), "MMM d, h:mm a")}
            </span>
            
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex gap-2">
                {notification.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle action
                    }}
                    className="text-[10px] font-bold text-primary hover:text-primary-dark flex items-center gap-1"
                  >
                    {action.label}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function NotificationCenter() {
  const { 
    notifications, 
    markNotificationRead, 
    currentUser,
    notificationPreferences,
    updateNotificationPreferences
  } = useScheduleStore();
  
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const userPrefs = currentUser ? notificationPreferences[currentUser.id] : undefined;
  
  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.readAt;
    return true;
  }).filter(n => 
    // Only show notifications for current user or global ones
    n.providerId === currentUser?.id || !n.providerId
  );

  const unreadCount = notifications.filter(n => !n.readAt && n.providerId === currentUser?.id).length;

  const markAllRead = () => {
    notifications
      .filter(n => !n.readAt && n.providerId === currentUser?.id)
      .forEach(n => markNotificationRead(n.id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel p-6 bg-white/60 rounded-[2rem] border border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary relative">
            <Bell className="w-5 h-5 stroke-[2.5]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Notifications</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {unreadCount} unread · {filteredNotifications.length} total
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 rounded-xl transition-all"
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-all ${showSettings ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && currentUser && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Notification Preferences
              </h3>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Email Notifications</span>
                  <input
                    type="checkbox"
                    checked={userPrefs?.emailEnabled ?? true}
                    onChange={(e) => updateNotificationPreferences(currentUser.id, { emailEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">In-App Notifications</span>
                  <input
                    type="checkbox"
                    checked={userPrefs?.inAppEnabled ?? true}
                    onChange={(e) => updateNotificationPreferences(currentUser.id, { inAppEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Notify me about:
                  </p>
                  <div className="space-y-2">
                    {(['SHIFT_REMINDER', 'SWAP_REQUEST', 'SCHEDULE_CHANGE', 'CONFLICT_DETECTED'] as NotificationType[]).map((type) => (
                      <label key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={userPrefs?.subscribedTypes?.includes(type) ?? true}
                          onChange={(e) => {
                            const current = userPrefs?.subscribedTypes ?? [];
                            const updated = e.target.checked
                              ? [...current, type]
                              : current.filter(t => t !== type);
                            updateNotificationPreferences(currentUser.id, { subscribedTypes: updated });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-600">
                          {type.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              filter === f 
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-2 bg-error text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Bell className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-lg font-bold text-slate-700">No Notifications</p>
              <p className="text-sm text-slate-400 mt-1">
                {filter === "unread" ? "All caught up!" : "You're all set"}
              </p>
            </motion.div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Notification bell button for the header
export function NotificationBell() {
  const { notifications, currentUser } = useScheduleStore();
  const unreadCount = notifications.filter(n => 
    !n.readAt && (n.providerId === currentUser?.id || !n.providerId)
  ).length;

  return (
    <button className="relative p-2 text-slate-400 hover:text-primary transition-colors">
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
