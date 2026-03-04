import { useState } from "react";
import type { OptimizationPreview } from "@/components/ScheduleChangePreview";

export function useScheduleChangePreview() {
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<OptimizationPreview | null>(null);

  const showPreview = (newPreview: OptimizationPreview) => {
    setPreview(newPreview);
    setIsOpen(true);
  };

  const closePreview = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    preview,
    showPreview,
    closePreview
  };
}
