import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, User, Calendar, Clock, Sparkles } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useScheduleStore } from '@/store';

export interface SearchResult {
  id: string;
  type: 'provider' | 'shift' | 'date' | 'action';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action: () => void;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const providers = useScheduleStore(state => state.providers);
  const slots = useScheduleStore(state => state.slots);

  // Generate search results based on query
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const items: SearchResult[] = [];

    // Search providers
    providers.forEach(provider => {
      if (provider.name.toLowerCase().includes(lowerQuery)) {
        items.push({
          id: `provider-${provider.id}`,
          type: 'provider',
          title: provider.name,
          subtitle: `${provider.skills.join(', ')} • ${provider.role}`,
          icon: <User className="w-4 h-4" />,
          action: () => {
            // Navigate to provider or highlight in list
            console.log('Selected provider:', provider.name);
            onClose();
          },
        });
      }
    });

    // Search shifts by date
    const uniqueDates = [...new Set(slots.map(s => s.date))];
    uniqueDates.forEach(date => {
      if (date.includes(lowerQuery) || formatDate(date).toLowerCase().includes(lowerQuery)) {
        items.push({
          id: `date-${date}`,
          type: 'date',
          title: formatDate(date),
          subtitle: `${slots.filter(s => s.date === date && s.providerId).length} shifts assigned`,
          icon: <Calendar className="w-4 h-4" />,
          action: () => {
            // Navigate to date
            console.log('Selected date:', date);
            onClose();
          },
        });
      }
    });

    // Search unfilled shifts
    if (['unfilled', 'empty', 'open'].some(term => lowerQuery.includes(term))) {
      const unfilledSlots = slots.filter(s => !s.providerId);
      items.push({
        id: 'unfilled-shifts',
        type: 'action',
        title: 'Show Unfilled Shifts',
        subtitle: `${unfilledSlots.length} shifts need coverage`,
        icon: <Clock className="w-4 h-4" />,
        action: () => {
          // Filter to show unfilled
          console.log('Showing unfilled shifts');
          onClose();
        },
      });
    }

    // Quick actions
    if (lowerQuery.includes('auto') || lowerQuery.includes('assign')) {
      items.push({
        id: 'auto-assign',
        type: 'action',
        title: 'Auto-Assign Shifts',
        subtitle: 'Let AI fill the schedule',
        icon: <Sparkles className="w-4 h-4" />,
        action: () => {
          // Trigger auto-assign
          console.log('Auto-assigning');
          onClose();
        },
      });
    }

    return items.slice(0, 10); // Limit to 10 results
  }, [query, providers, slots, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [results, selectedIndex, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.global-search-container')) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Search Modal */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`global-search-container fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 ${
              isDark ? 'bg-slate-800' : 'bg-white'
            } rounded-2xl shadow-2xl overflow-hidden`}
          >
            {/* Search Input */}
            <div className={`flex items-center gap-3 px-4 py-4 border-b ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <Search className={`w-5 h-5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search providers, dates, or type a command..."
                className={`flex-1 bg-transparent border-none outline-none text-base ${
                  isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className={`p-1 rounded-lg ${
                    isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs ${
                isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {results.length === 0 && query && (
                <div className={`px-4 py-8 text-center ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <p>No results found for &quot;{query}&quot;</p>
                  <p className="text-sm mt-1 opacity-70">Try searching for a provider name or date</p>
                </div>
              )}

              {results.length === 0 && !query && (
                <div className={`px-4 py-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <p className="text-sm font-medium mb-3 opacity-70">Try searching for:</p>
                  <div className="flex flex-wrap gap-2">
                    {['Providers', 'Dates', 'Unfilled shifts', 'Auto-assign'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setQuery(suggestion.toLowerCase())}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isDark
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={result.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? isDark ? 'bg-slate-700' : 'bg-blue-50'
                      : isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    index === selectedIndex
                      ? isDark ? 'bg-slate-600 text-blue-400' : 'bg-blue-100 text-blue-600'
                      : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className={`text-sm truncate ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  {index === selectedIndex && (
                    <kbd className={`hidden sm:block px-2 py-1 rounded text-xs ${
                      isDark ? 'bg-slate-600 text-slate-300' : 'bg-white text-slate-500'
                    }`}>
                      ↵
                    </kbd>
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            {results.length > 0 && (
              <div className={`flex items-center justify-between px-4 py-2 text-xs ${
                isDark ? 'bg-slate-900/50 text-slate-500' : 'bg-slate-50 text-slate-400'
              }`}>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-current/10">↑↓</kbd> to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-current/10">↵</kbd> to select
                  </span>
                </div>
                <span>{results.length} results</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Hook to manage search modal state
 */
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);
  const toggleSearch = useCallback(() => setIsOpen(prev => !prev), []);

  // Listen for keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, openSearch, closeSearch, toggleSearch };
}

export default GlobalSearch;
