import { useState } from "react";
import {
  AlertTriangle,
  Download,
  Layers,
  Monitor,
  Moon,
  MoreHorizontal,
  RefreshCcw,
  Redo2,
  Save,
  Sparkles,
  Sun,
  Trash,
  Undo2,
  Upload,
} from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface WorkspaceMenuProps {
  startDate: string;
  numWeeks: number;
  onScheduleRangeChange: (startDate: string, numWeeks: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoFill: () => void;
  onImport: () => void;
  onExport: () => void;
  canRollbackImport: boolean;
  onRollbackImport: () => void;
  onToggleScenarios: () => void;
  onSaveToServer: () => void;
  onRestoreLastGood: () => void;
  onClearSchedule: () => void;
  onClearStaff: () => void;
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

function MenuItem({
  icon: Icon,
  label,
  hint,
  tone = "default",
  disabled,
  onClick,
}: {
  icon: typeof Sun;
  label: string;
  hint?: string;
  tone?: "default" | "warning" | "error";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "default" && "text-foreground hover:bg-secondary/70",
        tone === "warning" && "text-warning hover:bg-warning/10",
        tone === "error" && "text-error hover:bg-error/10",
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", tone === "default" && "text-foreground-muted")}
        strokeWidth={1.8}
      />
      <span className="flex-1 truncate">{label}</span>
      {hint && <kbd className="text-[10.5px] font-semibold text-foreground-muted">{hint}</kbd>}
    </button>
  );
}

/**
 * Every secondary schedule operation, folded behind one button. The top bar
 * keeps a single primary action; nothing else earns permanent space.
 */
export function WorkspaceMenu(props: WorkspaceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const run = (action: () => void) => () => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More actions"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground-secondary transition-colors hover:bg-secondary/70",
          isOpen && "bg-secondary text-foreground",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
          >
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground-muted">
                Planning window
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Start date"
                  value={props.startDate}
                  onChange={(e) => props.onScheduleRangeChange(e.target.value, props.numWeeks)}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-foreground-tertiary">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    aria-label="Number of weeks"
                    value={props.numWeeks}
                    onChange={(e) =>
                      props.onScheduleRangeChange(
                        props.startDate,
                        Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }
                    className="w-11 rounded-md border border-border bg-surface px-1 py-1 text-center text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  wks
                </label>
              </div>
            </div>

            <div className="my-1 border-t border-border/70" />

            <MenuItem icon={Undo2} label="Undo" hint="⌘Z" disabled={!props.canUndo} onClick={run(props.onUndo)} />
            <MenuItem icon={Redo2} label="Redo" hint="⇧⌘Z" disabled={!props.canRedo} onClick={run(props.onRedo)} />
            <MenuItem icon={Sparkles} label="Fill empty slots" onClick={run(props.onAutoFill)} />

            <div className="my-1 border-t border-border/70" />

            <MenuItem icon={Upload} label="Import from Excel" onClick={run(props.onImport)} />
            <MenuItem icon={Download} label="Export…" onClick={run(props.onExport)} />
            {props.canRollbackImport && (
              <MenuItem icon={RefreshCcw} label="Roll back last import" onClick={run(props.onRollbackImport)} />
            )}
            <MenuItem icon={Layers} label="Scenarios" onClick={run(props.onToggleScenarios)} />

            <div className="my-1 border-t border-border/70" />

            <MenuItem icon={Save} label="Save to server" onClick={run(props.onSaveToServer)} />
            <MenuItem icon={RefreshCcw} label="Restore last good schedule" onClick={run(props.onRestoreLastGood)} />

            <div className="my-1 border-t border-border/70" />

            <MenuItem
              icon={Trash}
              label="Clear assignments"
              tone="warning"
              onClick={run(props.onClearSchedule)}
            />
            <MenuItem
              icon={AlertTriangle}
              label="Reset staff profiles"
              tone="error"
              onClick={run(props.onClearStaff)}
            />

            <div className="my-1 border-t border-border/70" />

            <div className="px-2.5 pb-1.5 pt-1">
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground-muted">
                Appearance
              </p>
              <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-0.5">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[11.5px] font-medium transition-colors",
                      theme === value
                        ? "bg-surface text-foreground shadow-xs"
                        : "text-foreground-tertiary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
