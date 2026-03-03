import { useState } from "react";
import { useScheduleStore, type ShiftType } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Play, 
  Copy,
  Users,
  Calendar,
  Clock,
  Check,
  X,
  LayoutGrid,
  Moon
} from "lucide-react";
import { format, parseISO } from "date-fns";

export function ScheduleTemplates() {
  const {
    scheduleTemplates,
    currentUser,
    createTemplate,
    deleteTemplate,
    applyTemplate,
  } = useScheduleStore();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplateDuration, setNewTemplateDuration] = useState(2);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [applyStartDate, setApplyStartDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) return;
    
    // Create a simple rotation pattern
    const pattern = [];
    for (let week = 0; week < newTemplateDuration; week++) {
      for (let day = 0; day < 7; day++) {
        const dayOffset = week * 7 + day;
        // Simple pattern: G20 every day, Nights every other day
        pattern.push({
          dayOffset,
          shiftType: "DAY" as ShiftType,
          location: "G20 Unit",
          assignment: "ROTATE",
        });
        if (day % 2 === 0) {
          pattern.push({
            dayOffset,
            shiftType: "NIGHT" as ShiftType,
            location: "Main Campus (Nights)",
            assignment: "ROTATE",
          });
        }
      }
    }
    
    createTemplate({
      name: newTemplateName,
      description: newTemplateDesc,
      durationWeeks: newTemplateDuration,
      pattern,
      createdBy: currentUser?.id || "unknown",
      isSystem: false,
    });
    
    setIsCreating(false);
    setNewTemplateName("");
    setNewTemplateDesc("");
    setNewTemplateDuration(2);
  };

  const handleApply = (templateId: string) => {
    applyTemplate(templateId, applyStartDate);
    setSelectedTemplate(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel p-6 bg-white/60 rounded-[2rem] border border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
            <FileText className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Schedule Templates</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {scheduleTemplates.length} saved templates
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          New Template
        </button>
      </div>

      {/* Create Template Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200/60 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Create New Template</h3>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Template name..."
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Duration:</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newTemplateDuration}
                    onChange={(e) => setNewTemplateDuration(Number(e.target.value))}
                    className="w-20 bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-xs text-slate-500">weeks</span>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplateName.trim()}
                  className="bg-primary text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all disabled:opacity-50"
                >
                  Create Template
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates List */}
      <div className="space-y-3">
        {scheduleTemplates.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
              <FileText className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-700">No Templates Yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Create templates for common rotation patterns
            </p>
          </div>
        ) : (
          scheduleTemplates.map((template) => (
            <motion.div
              key={template.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-white/40 rounded-2xl border border-slate-200/40 hover:border-primary/20 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-800">{template.name}</h4>
                    {template.isSystem && (
                      <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                        System
                      </span>
                    )}
                  </div>
                  
                  {template.description && (
                    <p className="text-xs text-slate-500 mb-2">{template.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {template.durationWeeks} weeks
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutGrid className="w-3 h-3" />
                      {template.pattern.length} slots
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created {format(parseISO(template.createdAt), "MMM d")}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all"
                    title="Apply Template"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  {!template.isSystem && (
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-error/10 hover:text-error transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Apply Form */}
              <AnimatePresence>
                {selectedTemplate === template.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">Start date:</span>
                        <input
                          type="date"
                          value={applyStartDate}
                          onChange={(e) => setApplyStartDate(e.target.value)}
                          className="bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          onClick={() => handleApply(template.id)}
                          className="px-4 py-2 bg-success text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-success-dark transition-all flex items-center gap-2"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Apply
                        </button>
                        <button
                          onClick={() => setSelectedTemplate(null)}
                          className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Preset Templates Info */}
      <div className="mt-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          Coming Soon: Preset Templates
        </h4>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            A-Team / B-Team Rotation
          </span>
          <span className="flex items-center gap-2">
            <Moon className="w-3 h-3" />
            Night-Heavy Pattern
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Academic Schedule
          </span>
          <span className="flex items-center gap-2">
            <Copy className="w-3 h-3" />
            Custom Patterns
          </span>
        </div>
      </div>
    </motion.div>
  );
}
