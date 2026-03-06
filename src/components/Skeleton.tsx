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
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`p-4 rounded-xl border ${
          useTheme().resolvedTheme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
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
