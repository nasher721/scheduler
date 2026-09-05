import type { ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "local" | "error";

const SAVE_LABEL: Record<Exclude<SaveStatus, "idle">, string> = {
  pending: "Unsaved",
  saving: "Saving",
  saved: "Saved",
  local: "On this device",
  error: "Save failed",
};

interface TopBarProps {
  title: string;
  hint: string;
  saveStatus: SaveStatus;
  isOnline: boolean;
  onOpenSearch: () => void;
  onOpenSidebar: () => void;
  /** Primary action plus the overflow menu. */
  actions?: ReactNode;
}

/**
 * A single 56px bar: where you are, one way to search, one primary action,
 * and everything else folded into the overflow menu passed as `actions`.
 */
export function TopBar({
  title,
  hint,
  saveStatus,
  isOnline,
  onOpenSearch,
  onOpenSidebar,
  actions,
}: TopBarProps) {
  const statusLabel = !isOnline ? "Offline" : saveStatus === "idle" ? null : SAVE_LABEL[saveStatus];
  const statusTone = !isOnline || saveStatus === "error" ? "error" : saveStatus === "saved" ? "success" : "muted";

  return (
    <header className="workspace-topbar no-print sticky top-0 z-30 flex min-h-16 shrink-0 items-center gap-2 border-b border-border/70 bg-surface px-4 sm:gap-3 sm:px-7 2xl:px-10">
      <button
        type="button"
        onClick={(event) => {
          // Safari does not focus buttons on pointer activation. Give the drawer
          // a stable trigger to restore when it closes.
          event.currentTarget.focus();
          onOpenSidebar();
        }}
        className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-secondary/70 xl:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="hidden shrink-0 text-sm text-foreground-secondary lg:inline">Neurocritical care <span className="mx-2 text-foreground-muted" aria-hidden="true">/</span></span>
        <p className="truncate text-sm font-medium" title={hint}>{title}</p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-11 w-52 items-center gap-2 rounded-lg border border-border bg-background px-3 text-left transition-colors hover:border-border-strong md:flex 2xl:w-64"
        aria-label="Search people and shifts"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        <span className="flex-1 truncate text-sm text-foreground-muted">Search people & shifts</span>
        <kbd className="rounded border border-border bg-background px-1 text-[10.5px] font-semibold text-foreground-muted">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-secondary/70 md:hidden"
        aria-label="Search"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {actions}

      {statusLabel && (
        <div role="status" className="hidden items-center gap-1.5 border-l border-border/70 pl-3 2xl:flex">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              statusTone === "error" && "bg-error",
              statusTone === "success" && "bg-success",
              statusTone === "muted" && "bg-foreground-muted",
            )}
          />
          <span className="text-xs text-foreground-tertiary">{statusLabel}</span>
        </div>
      )}
    </header>
  );
}
