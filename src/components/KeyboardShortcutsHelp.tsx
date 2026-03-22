import { useEffect } from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { defaultShortcuts, groupShortcutsByCategory, formatShortcut } from '@/hooks/useKeyboardShortcuts';
import { motion, AnimatePresence } from 'framer-motion';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const groupedShortcuts = groupShortcutsByCategory(defaultShortcuts);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[80vh] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDark ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Keyboard Shortcuts
                  </h2>
                  <p className={`text-sm ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Press <kbd className={`px-1.5 py-0.5 rounded text-xs ${
                      isDark ? 'bg-slate-800' : 'bg-slate-100'
                    }`}>?</kbd> anytime to open this help
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'hover:bg-slate-800 text-slate-400 hover:text-white' 
                    : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto p-6 ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}>
              <div className="space-y-8">
                {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                  <div key={category}>
                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {shortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                            isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                          } transition-colors`}
                        >
                          <span className={`text-sm ${
                            isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            {shortcut.description}
                          </span>
                          <kbd className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                            isDark 
                              ? 'bg-slate-800 text-slate-300 border border-slate-700' 
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {formatShortcut(shortcut).split('+').map((part, i, arr) => (
                              <span key={i} className="flex items-center gap-1">
                                {part === 'Ctrl' ? (
                                  <Command className="w-3 h-3" />
                                ) : (
                                  part
                                )}
                                {i < arr.length - 1 && <span className="opacity-50">+</span>}
                              </span>
                            ))}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro tip */}
              <div className={`mt-8 p-4 rounded-xl ${
                isDark ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-100'
              }`}>
                <p className={`text-sm ${
                  isDark ? 'text-blue-300' : 'text-blue-700'
                }`}>
                  <strong>Pro tip:</strong> Shortcuts work everywhere except when typing in text fields. 
                  Use them to speed up your scheduling workflow!
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${
              isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
            }`}>
              <button
                onClick={onClose}
                className={`w-full py-2.5 px-4 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default KeyboardShortcutsHelp;
