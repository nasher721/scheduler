# Shared UI components

Framework: React 18 + TypeScript + Vite; Tailwind CSS 3; Zustand; Framer Motion; Lucide React. No external component library is installed. Verbatim shared primitives from the current checkout.

### src/components/Skeleton.tsx

```tsx
import { useTheme } from '@/hooks/useTheme';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const baseStyles = 'block';

  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationStyles = {
    pulse: isDark ? 'animate-pulse bg-slate-700' : 'animate-pulse bg-slate-200',
    wave: isDark
      ? 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-slate-600/20 before:to-transparent bg-slate-700'
      : 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-slate-400/20 before:to-transparent bg-slate-200',
    none: isDark ? 'bg-slate-700' : 'bg-slate-200',
  };

  const style = {
    width: width,
    height: height,
  };

  return (
    <span
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton patterns for common UI elements

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          width={i === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 rounded-xl border ${
      useTheme().resolvedTheme === 'dark' ? 'border-slate-700' : 'border-slate-200'
    } ${className}`}>
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonProviderItem({ className = '' }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${
      isDark ? 'bg-slate-800' : 'bg-white'
    } border ${isDark ? 'border-slate-700' : 'border-slate-200'} ${className}`}>
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-1.5">
        <Skeleton variant="text" width="70%" height={18} />
        <Skeleton variant="text" width="50%" height={14} />
      </div>
      <Skeleton variant="rounded" width={24} height={24} />
    </div>
  );
}

export function SkeletonShiftSlot({ className = '' }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`p-3 rounded-xl border ${
      isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
    } ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <Skeleton variant="text" width="40%" height={16} />
        <Skeleton variant="rounded" width={16} height={16} />
      </div>
      <Skeleton variant="text" width="60%" height={20} />
    </div>
  );
}

export function SkeletonCalendarDay({ className = '' }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`p-3 rounded-xl border ${
      isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/50'
    } ${className}`}>
      <Skeleton variant="text" width="30%" height={14} className="mb-3" />
      <div className="space-y-2">
        <SkeletonShiftSlot />
        <SkeletonShiftSlot />
      </div>
    </div>
  );
}

export function SkeletonStats({ className = '' }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`p-4 rounded-xl border ${
          isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        }`}>
          <Skeleton variant="text" width="60%" height={14} className="mb-2" />
          <Skeleton variant="text" width="40%" height={32} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonAnalytics({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <Skeleton variant="rounded" height={200} />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={120} />
      </div>
    </div>
  );
}

export default Skeleton;

```

### src/components/Toast.tsx

```tsx
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-rose-50 border-rose-200 text-rose-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

const iconColorMap = {
  success: "text-emerald-500",
  error: "text-rose-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useScheduleStore(useShallow((s) => ({ toasts: s.toasts, dismissToast: s.dismissToast })));

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-xl max-w-sm ${colorMap[toast.type]}`}
            >
              <div className={`shrink-0 ${iconColorMap[toast.type]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 opacity-60" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

```

### src/components/ThemeToggle.tsx

```tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, Theme } from '@/hooks/useTheme';
import { useState, useRef, useEffect } from 'react';

interface ThemeToggleProps {
  variant?: 'icon' | 'button' | 'dropdown';
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  const currentIcon = resolvedTheme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />;

  if (variant === 'icon') {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        className={`p-2 rounded-xl transition-all duration-200 ${
          resolvedTheme === 'dark'
            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
            : 'bg-white text-slate-600 hover:bg-slate-100 shadow-sm'
        } ${className}`}
        aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        {currentIcon}
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
          resolvedTheme === 'dark'
            ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
            : 'bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
        } ${className}`}
      >
        {currentIcon}
        <span>{resolvedTheme === 'dark' ? 'Dark' : 'Light'} Mode</span>
      </button>
    );
  }

  // Dropdown variant
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
          resolvedTheme === 'dark'
            ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
            : 'bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {currentIcon}
        <span className="hidden sm:inline text-sm font-medium">
          {themeOptions.find(t => t.value === theme)?.label}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-40 rounded-xl shadow-lg border overflow-hidden z-50 ${
            resolvedTheme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
          role="listbox"
        >
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setTheme(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                theme === option.value
                  ? resolvedTheme === 'dark'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-900'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300 hover:bg-slate-700'
                    : 'text-slate-700 hover:bg-slate-50'
              }`}
              role="option"
              aria-selected={theme === option.value}
            >
              {option.icon}
              {option.label}
              {theme === option.value && (
                <span className="ml-auto text-xs opacity-60">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeToggle;

```

### src/components/NotificationBanner.tsx

```tsx
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface NotificationBannerProps {
  criticalGaps: number;
  skillRisks: number;
  fatigueExposures: number;
  onViewDetails: () => void;
}

export function NotificationBanner({ criticalGaps, skillRisks, fatigueExposures, onViewDetails }: NotificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (criticalGaps === 0 && skillRisks === 0 && fatigueExposures === 0) return null;
  if (dismissed) return null;

  const total = criticalGaps + skillRisks + fatigueExposures;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3 dark:bg-amber-900/20 dark:border-amber-800">
      <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span>
          <span className="font-semibold">{total} alert{total !== 1 ? "s" : ""}</span>
          {": "}
          {criticalGaps > 0 && `${criticalGaps} critical gap${criticalGaps !== 1 ? "s" : ""}`}
          {criticalGaps > 0 && skillRisks > 0 && ", "}
          {skillRisks > 0 && `${skillRisks} skill risk${skillRisks !== 1 ? "s" : ""}`}
          {(criticalGaps > 0 || skillRisks > 0) && fatigueExposures > 0 && ", "}
          {fatigueExposures > 0 && `${fatigueExposures} fatigue exposure${fatigueExposures !== 1 ? "s" : ""}`}
          {" detected."}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onViewDetails}
          className="px-3 py-1 text-xs font-medium text-amber-800 border border-amber-300 rounded-full hover:bg-amber-100 transition-colors dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/30"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-amber-500 hover:text-amber-700 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

```
