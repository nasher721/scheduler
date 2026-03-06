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
