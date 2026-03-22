import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EnhancedCalendar } from "@/components/EnhancedCalendar";
import { ExcelGridView } from "@/components/ExcelGridView";
import { useScheduleStore } from "@/store";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ScheduleToolbar } from "./ScheduleToolbar";

export function ScheduleWorkspace() {
  const surfaceView = useScheduleStore((state) => state.scheduleViewport.surfaceView);
  const shiftWeekOffset = useScheduleStore((state) => state.shiftWeekOffset);
  const setScheduleSurfaceView = useScheduleStore((state) => state.setScheduleSurfaceView);
  const prefersReducedMotion = useReducedMotion();

  useKeyboardShortcuts([
    { key: "1", alt: true, description: "Calendar view", action: () => setScheduleSurfaceView("calendar") },
    { key: "2", alt: true, description: "Table view", action: () => setScheduleSurfaceView("excel") },
    { key: "ArrowLeft", alt: true, description: "Previous week", action: () => shiftWeekOffset(-1) },
    { key: "ArrowRight", alt: true, description: "Next week", action: () => shiftWeekOffset(1) },
  ]);

  return (
    <div className="w-full">
      <ScheduleToolbar />
      <AnimatePresence mode="wait">
        <motion.div
          key={surfaceView}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
        >
          {surfaceView === "excel" ? <ExcelGridView /> : <EnhancedCalendar />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
