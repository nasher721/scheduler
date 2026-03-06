/**
 * TemplateLibrary Component
 * 
 * Modal for creating, managing, and applying shift templates.
 * Part of Phase 2: Shift Management
 */

import { useState, useCallback } from 'react';
import { useScheduleStore, type ShiftType, type ServicePriority } from '@/store';
import type { ShiftTemplate, CreateFromTemplateRequest } from '@/types/calendar';
import { formatShiftType, formatPriority } from '../../utils/accessibilityUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  X,
  Sun,
  Moon,
  Sparkles,
  AlertTriangle,
  Activity,
  Stethoscope,
  Clock,
  MapPin,
  Shield,
  ChevronRight,
  Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, parseISO } from 'date-fns';

// Shift type icons
const SHIFT_TYPE_ICONS: Record<ShiftType, typeof Sun> = {
  DAY: Sun,
  NIGHT: Moon,
  NMET: Sparkles,
  JEOPARDY: AlertTriangle,
  RECOVERY: Activity,
  CONSULTS: Stethoscope,
  VACATION: Clock
};

const SHIFT_TYPE_COLORS: Record<ShiftType, string> = {
  DAY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NIGHT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  NMET: 'bg-amber-50 text-amber-700 border-amber-200',
  JEOPARDY: 'bg-rose-50 text-rose-700 border-rose-200',
  RECOVERY: 'bg-teal-50 text-teal-700 border-teal-200',
  CONSULTS: 'bg-sky-50 text-sky-700 border-sky-200',
  VACATION: 'bg-slate-50 text-slate-600 border-slate-200'
};

interface TemplateLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateLibrary({ isOpen, onClose }: TemplateLibraryProps) {
  const { providers, currentUser } = useScheduleStore();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create template form state
  const [createForm, setCreateForm] = useState<Partial<ShiftTemplate>>({
    name: '',
    description: '',
    shiftType: 'DAY',
    servicePriority: 'STANDARD',
    serviceLocation: '',
    requiredSkill: '',
    duration: 12,
    notes: '',
    checkList: [],
    isShared: false
  });

  // Apply template form state
  const [applyForm, setApplyForm] = useState<{
    startDate: string;
    endDate: string;
    daysOfWeek: number[];
  }>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    daysOfWeek: [1, 2, 3, 4, 5] // Mon-Fri default
  });

  const handleCreateTemplate = useCallback(() => {
    if (!createForm.name || !currentUser) return;

    const newTemplate: ShiftTemplate = {
      id: `template-${Date.now()}`,
      name: createForm.name,
      description: createForm.description,
      shiftType: createForm.shiftType || 'DAY',
      servicePriority: createForm.servicePriority || 'STANDARD',
      serviceLocation: createForm.serviceLocation || '',
      requiredSkill: createForm.requiredSkill || '',
      duration: createForm.duration || 12,
      notes: createForm.notes,
      checkList: createForm.checkList || [],
      isShared: createForm.isShared || false,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTemplates(prev => [...prev, newTemplate]);
    setIsCreating(false);
    setCreateForm({
      name: '',
      description: '',
      shiftType: 'DAY',
      servicePriority: 'STANDARD',
      serviceLocation: '',
      requiredSkill: '',
      duration: 12,
      notes: '',
      checkList: [],
      isShared: false
    });
    setActiveTab('browse');
  }, [createForm, currentUser]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(null);
    }
  }, [selectedTemplate]);

  const handleDuplicateTemplate = useCallback((template: ShiftTemplate) => {
    const duplicated: ShiftTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTemplates(prev => [...prev, duplicated]);
  }, []);

  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplate) return;

    const request: CreateFromTemplateRequest = {
      templateId: selectedTemplate.id,
      dateRange: {
        start: applyForm.startDate,
        end: applyForm.endDate
      },
      daysOfWeek: applyForm.daysOfWeek
    };

    // TODO: Call API to apply template
    console.log('Applying template:', request);
    
    setIsApplying(false);
    setSelectedTemplate(null);
    onClose();
  }, [selectedTemplate, applyForm, onClose]);

  const weekDays = [
    { value: 0, label: 'Sun', short: 'S' },
    { value: 1, label: 'Mon', short: 'M' },
    { value: 2, label: 'Tue', short: 'T' },
    { value: 3, label: 'Wed', short: 'W' },
    { value: 4, label: 'Thu', short: 'T' },
    { value: 5, label: 'Fri', short: 'F' },
    { value: 6, label: 'Sat', short: 'S' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Shift Templates
          </DialogTitle>
          <DialogDescription>
            Create and manage reusable shift templates for quick scheduling
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'browse' | 'create')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Templates</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="flex-1 flex flex-col overflow-hidden mt-4">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Copy className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No templates yet</h3>
                <p className="text-sm text-slate-500 max-w-sm mb-4">
                  Create reusable shift templates to quickly schedule recurring shifts
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first template
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Template List */}
                <ScrollArea className="flex-1 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {templates.map(template => {
                      const Icon = SHIFT_TYPE_ICONS[template.shiftType];
                      return (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                            selectedTemplate?.id === template.id
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <div className={cn('p-2 rounded-lg', SHIFT_TYPE_COLORS[template.shiftType])}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 truncate">
                                {template.name}
                              </span>
                              {template.isShared && (
                                <Badge variant="secondary" className="text-xs">Shared</Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {template.serviceLocation} • {template.duration}h
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateTemplate(template);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Template Details / Apply */}
                {selectedTemplate && (
                  <div className="w-80 border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedTemplate.name}</h3>
                      <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4" />
                        {selectedTemplate.serviceLocation}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4" />
                        {selectedTemplate.duration} hours
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Shield className="w-4 h-4" />
                        {formatPriority(selectedTemplate.servicePriority)}
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-3">
                      <h4 className="font-medium text-sm">Apply Template</h4>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Date Range</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={applyForm.startDate}
                            onChange={(e) => setApplyForm(prev => ({ ...prev, startDate: e.target.value }))}
                            className="text-sm"
                          />
                          <Input
                            type="date"
                            value={applyForm.endDate}
                            onChange={(e) => setApplyForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Days of Week</Label>
                        <div className="flex gap-1">
                          {weekDays.map(day => (
                            <button
                              key={day.value}
                              onClick={() => {
                                setApplyForm(prev => ({
                                  ...prev,
                                  daysOfWeek: prev.daysOfWeek.includes(day.value)
                                    ? prev.daysOfWeek.filter(d => d !== day.value)
                                    : [...prev.daysOfWeek, day.value].sort()
                                }));
                              }}
                              className={cn(
                                'w-8 h-8 rounded text-xs font-medium transition-colors',
                                applyForm.daysOfWeek.includes(day.value)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              )}
                              title={day.label}
                            >
                              {day.short}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button 
                        className="w-full" 
                        onClick={handleApplyTemplate}
                        disabled={applyForm.daysOfWeek.length === 0}
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        Apply Template
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name *</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Standard Day Shift"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-description">Description</Label>
                  <Input
                    id="template-description"
                    placeholder="Brief description of this template"
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shift Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(SHIFT_TYPE_ICONS) as ShiftType[]).map(type => {
                        const Icon = SHIFT_TYPE_ICONS[type];
                        return (
                          <button
                            key={type}
                            onClick={() => setCreateForm(prev => ({ ...prev, shiftType: type }))}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg border text-left transition-colors',
                              createForm.shiftType === type
                                ? 'border-primary bg-primary/5'
                                : 'border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm">{formatShiftType(type)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <div className="space-y-2">
                      {(['CRITICAL', 'STANDARD', 'FLEXIBLE'] as ServicePriority[]).map(priority => (
                        <button
                          key={priority}
                          onClick={() => setCreateForm(prev => ({ ...prev, servicePriority: priority }))}
                          className={cn(
                            'w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors',
                            createForm.servicePriority === priority
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full', {
                            'bg-rose-500': priority === 'CRITICAL',
                            'bg-amber-500': priority === 'STANDARD',
                            'bg-slate-400': priority === 'FLEXIBLE'
                          })} />
                          <span className="text-sm">{formatPriority(priority)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-location">Location</Label>
                    <Input
                      id="template-location"
                      placeholder="e.g., MICU"
                      value={createForm.serviceLocation}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, serviceLocation: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-duration">Duration (hours)</Label>
                    <Input
                      id="template-duration"
                      type="number"
                      min={1}
                      max={24}
                      value={createForm.duration}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-skill">Required Skill</Label>
                  <Input
                    id="template-skill"
                    placeholder="e.g., ICU, Neuro"
                    value={createForm.requiredSkill}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, requiredSkill: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-notes">Default Notes</Label>
                  <textarea
                    id="template-notes"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Notes that will be added to shifts created from this template"
                    value={createForm.notes}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="template-shared"
                    checked={createForm.isShared}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, isShared: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="template-shared" className="text-sm font-normal cursor-pointer">
                    Share with organization
                  </Label>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          {activeTab === 'create' ? (
            <>
              <Button variant="outline" onClick={() => setActiveTab('browse')}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTemplate}
                disabled={!createForm.name}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Button to open template library
export function TemplateLibraryButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <Copy className="w-4 h-4 mr-2" />
        Templates
      </Button>
      <TemplateLibrary isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
