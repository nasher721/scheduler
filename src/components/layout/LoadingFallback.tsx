import { motion } from 'framer-motion';

/**
 * Loading state for Suspense boundaries when switching views.
 * Keeps layout shift minimal and matches the app design system.
 * Respects prefers-reduced-motion for accessibility.
 */
export function LoadingFallback() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="satin-panel p-8 rounded-2xl border border-slate-200/50 min-h-[320px] flex flex-col gap-6 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Loading view"
    >
      <div className="flex items-center gap-3">
        <div className="h-4 w-32 rounded-lg bg-slate-200/80 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-24 rounded-lg bg-slate-100 animate-pulse motion-reduce:animate-none" style={{ animationDelay: '0.1s' }} />
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-slate-100/80 animate-pulse motion-reduce:animate-none"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <div className="h-9 w-20 rounded-lg bg-slate-200/60 animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-24 rounded-lg bg-slate-200/60 animate-pulse motion-reduce:animate-none" style={{ animationDelay: '0.15s' }} />
      </div>
    </motion.div>
  );
}
