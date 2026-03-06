/**
 * KeyboardHelpModal Component
 * 
 * Displays keyboard shortcuts reference for the calendar.
 * Part of Phase 1: UX & Accessibility
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard, X, Command, ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { useCalendarKeyboard } from '../hooks/useCalendarKeyboard';
import type { KeyboardShortcut } from '../hooks/useCalendarKeyboard';

interface KeyboardHelpModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const GROUP_ICONS: Record<string, typeof Command> = {
  view: Command,
  navigation: ArrowLeft,
  action: Search,
  help: Keyboard
};

const GROUP_LABELS: Record<string, string> = {
  view: 'View Controls',
  navigation: 'Navigation',
  action: 'Actions',
  help: 'Help'
};

export function KeyboardHelpModal({ isOpen: controlledIsOpen, onClose: controlledOnClose }: KeyboardHelpModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const { groupedShortcuts, shortcutGroups } = useCalendarKeyboard();
  
  // Support both controlled and uncontrolled modes
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const onClose = controlledOnClose || (() => setInternalIsOpen(false));

  // Listen for toggle event from keyboard shortcut
  useEffect(() => {
    const handleToggle = () => {
      if (controlledIsOpen === undefined) {
        setInternalIsOpen(prev => !prev);
      }
    };

    window.addEventListener('toggle-keyboard-help', handleToggle);
    return () => window.removeEventListener('toggle-keyboard-help', handleToggle);
  }, [controlledIsOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const renderKeyCombo = (key: string) => {
    const parts = key.split('+').map(part => part.trim());
    
    return (
      <div className="flex items-center gap-1">
        {parts.map((part, index) => (
          <span key={index} className="flex items-center">
            <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono font-semibold text-slate-700 min-w-[24px] text-center">
              {part}
            </kbd>
            {index < parts.length - 1 && (
              <span className="mx-1 text-slate-400">+</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([group, shortcuts]) => {
              const Icon = GROUP_ICONS[group] || Keyboard;
              const label = shortcutGroups[group as keyof typeof shortcutGroups] || GROUP_LABELS[group] || group;
              
              return (
                <section key={group} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    <Icon className="w-4 h-4 text-slate-500" />
                    {label}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-sm text-slate-700">
                          {shortcut.description}
                        </span>
                        {renderKeyCombo(shortcut.key)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          
          {/* Tips section */}
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <h4 className="text-sm font-semibold text-primary mb-2">
              Pro Tips
            </h4>
            <ul className="space-y-1 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Press <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">?</kbd> anytime to show this help
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Use <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">Tab</kbd> to navigate between shifts
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">Esc</kbd> clears selection and closes modals
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="default">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage keyboard help modal state
export function useKeyboardHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);

  // Listen for toggle event
  useEffect(() => {
    const handleToggle = () => toggle();
    window.addEventListener('toggle-keyboard-help', handleToggle);
    return () => window.removeEventListener('toggle-keyboard-help', handleToggle);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle
  };
}

// Button to trigger keyboard help
export function KeyboardHelpButton({ className }: { className?: string }) {
  const { toggle } = useKeyboardHelp();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={className}
      title="Keyboard shortcuts (?)"
      aria-label="Show keyboard shortcuts"
    >
      <Keyboard className="w-4 h-4 mr-2" />
      <span className="hidden sm:inline">Shortcuts</span>
      <kbd className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-xs hidden md:inline">
        ?
      </kbd>
    </Button>
  );
}
