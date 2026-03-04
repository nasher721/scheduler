import { motion, AnimatePresence } from "framer-motion";
import { X, Command, CornerDownLeft, Slash, HelpCircle, FilePlus } from "lucide-react";

interface KeyboardHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: "Ctrl/Cmd + K", description: "Toggle AI Copilot", icon: Command },
  { key: "Ctrl/Cmd + N", description: "New conversation", icon: FilePlus },
  { key: "/", description: "Focus input field", icon: Slash },
  { key: "Esc", description: "Close copilot", icon: X },
  { key: "Enter", description: "Send message", icon: CornerDownLeft },
  { key: "Shift + ?", description: "Show this help", icon: HelpCircle },
];

export function KeyboardHelpOverlay({ isOpen, onClose }: KeyboardHelpOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Command className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
                  <p className="text-blue-100 text-sm">Work faster with these shortcuts</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="p-6">
              <div className="space-y-3">
                {shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={shortcut.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                        <shortcut.icon className="w-4 h-4 text-slate-600" />
                      </div>
                      <span className="text-sm text-slate-700">{shortcut.description}</span>
                    </div>
                    <kbd className="px-3 py-1.5 bg-white rounded-lg text-xs font-mono font-bold text-slate-600 shadow-sm border border-slate-200">
                      {shortcut.key}
                    </kbd>
                  </motion.div>
                ))}
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Pro Tip</h3>
                <p className="text-xs text-blue-600 leading-relaxed">
                  Use <kbd className="px-1.5 py-0.5 bg-white rounded text-[10px] font-mono">Ctrl/Cmd + K</kbd> to quickly 
                  open the AI assistant from anywhere in the app. Perfect for rapid schedule adjustments!
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
