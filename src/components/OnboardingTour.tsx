import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
export { TourPrompt } from './TourPrompt';

export interface TourStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const defaultSteps: TourStep[] = [
  {
    target: '.calendar-container',
    title: 'Welcome to Neuro ICU Scheduler',
    content: 'This is your main scheduling view. Drag providers to assign them to shifts.',
    position: 'bottom',
  },
  {
    target: '.provider-list',
    title: 'Provider Pool',
    content: 'Your team members are listed here. Drag them to assign shifts or click to view details.',
    position: 'right',
  },
  {
    target: '.auto-assign-btn',
    title: 'Auto-Assign',
    content: 'Let AI help you fill the schedule. It respects all constraints and preferences.',
    position: 'bottom',
  },
  {
    target: '.conflict-indicator',
    title: 'Conflict Detection',
    content: 'Watch for warnings about scheduling conflicts, credential expirations, and more.',
    position: 'left',
  },
  {
    target: '.analytics-panel',
    title: 'Coverage Analytics',
    content: 'Track your schedule health in real-time. Ensure fair distribution and adequate coverage.',
    position: 'left',
  },
  {
    target: '.copilot-trigger',
    title: 'AI Schedule Copilot',
    content: 'Ask in plain language: "Who\'s covering this weekend?", "Balance nights", or "Check conflicts." Type /help for capabilities or /tools for actions. The copilot can optimize, explain assignments, and more.',
    position: 'bottom',
  },
];

interface OnboardingTourProps {
  steps?: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function OnboardingTour({ 
  steps = defaultSteps, 
  isOpen, 
  onClose, 
  onComplete 
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const currentStepData = steps[currentStep];

  // Find target element position
  useEffect(() => {
    if (!isOpen || !currentStepData) return;

    const findTarget = () => {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      }
    };

    findTarget();
    // Re-check on resize
    window.addEventListener('resize', findTarget);
    return () => window.removeEventListener('resize', findTarget);
  }, [isOpen, currentStep, currentStepData]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete?.();
      onClose();
    }
  }, [currentStep, steps.length, onClose, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const padding = 16;
    const position = currentStepData.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          top: `${targetRect.top - padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left - padding}px`,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + padding}px`,
          transform: 'translateY(-50%)',
        };
      default:
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        };
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !currentStepData) return null;

  const tooltipPosition = getTooltipPosition();
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with spotlight effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{
              background: targetRect
                ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0px, ${isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)'} ${Math.max(targetRect.width, targetRect.height) + 40}px)`
                : isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)',
            }}
            onClick={handleSkip}
          />

          {/* Highlight box around target */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed z-50 pointer-events-none border-2 border-blue-500 rounded-lg"
              style={{
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
                boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.5)',
              }}
            />
          )}

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed z-50 w-80 rounded-2xl shadow-2xl ${
              isDark ? 'bg-slate-800' : 'bg-white'
            }`}
            style={tooltipPosition}
          >
            {/* Progress bar */}
            <div className={`h-1 rounded-t-2xl overflow-hidden ${
              isDark ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 ${
                    isDark ? 'text-yellow-400' : 'text-yellow-500'
                  }`} />
                  <span className={`text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Step {currentStep + 1} of {steps.length}
                  </span>
                </div>
                <button
                  onClick={handleSkip}
                  className={`p-1 rounded-lg transition-colors ${
                    isDark 
                      ? 'hover:bg-slate-700 text-slate-400' 
                      : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <h3 className={`text-lg font-semibold mb-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {currentStepData.title}
              </h3>
              <p className={`text-sm leading-relaxed mb-6 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {currentStepData.content}
              </p>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                <div className="flex items-center gap-1.5">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentStep
                          ? 'bg-blue-500'
                          : index < currentStep
                            ? isDark ? 'bg-slate-600' : 'bg-slate-300'
                            : isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default OnboardingTour;
