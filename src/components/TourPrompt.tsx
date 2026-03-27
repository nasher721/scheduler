import { motion, AnimatePresence } from 'framer-motion';
import { X, Compass } from 'lucide-react';

export function TourPrompt({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 shadow-lg hover:shadow-xl transition-shadow"
      >
        <button 
          type="button"
          onClick={onStart} 
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Compass className="w-4 h-4" />
          Take a quick tour
        </button>
        <button 
          type="button"
          onClick={onDismiss} 
          className="ml-1 p-0.5 rounded-full hover:bg-primary-foreground/20 transition-colors" 
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
