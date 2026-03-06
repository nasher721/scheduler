/**
 * HandoffModal Component
 * 
 * Structured shift handoff system for provider transitions.
 * Includes patient summaries, pending tasks, and critical alerts.
 * Part of Phase 2: Shift Management
 */

import { useState, useEffect } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import type { ShiftHandoff, HandoffTask } from '@/types/calendar';
import { format, parseISO } from 'date-fns';
import { useAnnounce } from '../../hooks/useAnnounce';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  ClipboardList,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ArrowRight,
  Save,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandoffModalProps {
  slot: ShiftSlot;
  outgoingProvider: Provider;
  incomingProvider: Provider;
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_COLORS = {
  high: 'bg-rose-100 text-rose-700 border-rose-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200'
};

export function HandoffModal({
  slot,
  outgoingProvider,
  incomingProvider,
  isOpen,
  onClose
}: HandoffModalProps) {
  const { announceSuccess } = useAnnounce();
  const [activeTab, setActiveTab] = useState<'edit' | 'view'>('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handoff state
  const [handoff, setHandoff] = useState<Partial<ShiftHandoff>>({
    patientSummary: '',
    pendingTasks: [],
    criticalAlerts: [],
    equipmentStatus: '',
    signOutNotes: ''
  });

  // New task form
  const [newTask, setNewTask] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<HandoffTask['priority']>('medium');

  // Add a task
  const addTask = () => {
    if (!newTask.trim()) return;

    const task: HandoffTask = {
      id: `task-${Date.now()}`,
      description: newTask.trim(),
      priority: newTaskPriority,
      completed: false
    };

    setHandoff(prev => ({
      ...prev,
      pendingTasks: [...(prev.pendingTasks || []), task]
    }));

    setNewTask('');
    setNewTaskPriority('medium');
  };

  // Remove a task
  const removeTask = (taskId: string) => {
    setHandoff(prev => ({
      ...prev,
      pendingTasks: prev.pendingTasks?.filter(t => t.id !== taskId) || []
    }));
  };

  // Toggle task completion
  const toggleTask = (taskId: string) => {
    setHandoff(prev => ({
      ...prev,
      pendingTasks: prev.pendingTasks?.map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ) || []
    }));
  };

  // Add critical alert
  const [newAlert, setNewAlert] = useState('');
  
  const addAlert = () => {
    if (!newAlert.trim()) return;
    
    setHandoff(prev => ({
      ...prev,
      criticalAlerts: [...(prev.criticalAlerts || []), newAlert.trim()]
    }));
    setNewAlert('');
  };

  // Remove alert
  const removeAlert = (index: number) => {
    setHandoff(prev => ({
      ...prev,
      criticalAlerts: prev.criticalAlerts?.filter((_, i) => i !== index) || []
    }));
  };

  // Submit handoff
  const handleSubmit = async () => {
    setIsSubmitting(true);

    // TODO: Save handoff to backend
    console.log('Submitting handoff:', handoff);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    announceSuccess('Shift handoff completed');
    setIsSubmitting(false);
    onClose();
  };

  // Check if handoff has content
  const hasContent = handoff.patientSummary || 
                     (handoff.pendingTasks && handoff.pendingTasks.length > 0) ||
                     (handoff.criticalAlerts && handoff.criticalAlerts.length > 0) ||
                     handoff.equipmentStatus ||
                     handoff.signOutNotes;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Shift Handoff
          </DialogTitle>
          <DialogDescription>
            Document important information for the incoming provider
          </DialogDescription>
        </DialogHeader>

        {/* Provider Transition Header */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="flex-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
              {outgoingProvider.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-slate-500">Outgoing</p>
              <p className="font-medium text-slate-900">{outgoingProvider.name}</p>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-slate-400" />
          
          <div className="flex-1 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold">
              {incomingProvider.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-slate-500">Incoming</p>
              <p className="font-medium text-slate-900">{incomingProvider.name}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Patient Summary */}
            <div className="space-y-2">
              <Label htmlFor="patient-summary" className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                Patient Summary
              </Label>
              <textarea
                id="patient-summary"
                rows={3}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Brief overview of patient status, key issues, and plan..."
                value={handoff.patientSummary}
                onChange={(e) => setHandoff(prev => ({ ...prev, patientSummary: e.target.value }))}
              />
            </div>

            {/* Pending Tasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  Pending Tasks
                </Label>
                <Badge variant="secondary">
                  {handoff.pendingTasks?.filter(t => !t.completed).length || 0} pending
                </Badge>
              </div>

              {/* Add Task */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a task..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  className="flex-1"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as HandoffTask['priority'])}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <Button size="sm" onClick={addTask} disabled={!newTask.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Task List */}
              <div className="space-y-2">
                {handoff.pendingTasks?.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-start gap-2 p-3 rounded-lg border transition-all',
                      task.completed ? 'bg-slate-50 opacity-60' : 'bg-white'
                    )}
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        task.completed && 'line-through text-slate-400'
                      )}>
                        {task.description}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs', PRIORITY_COLORS[task.priority])}
                    >
                      {task.priority}
                    </Badge>
                    <button
                      onClick={() => removeTask(task.id)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!handoff.pendingTasks || handoff.pendingTasks.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No tasks added yet
                  </p>
                )}
              </div>
            </div>

            {/* Critical Alerts */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
                Critical Alerts
              </Label>

              {/* Add Alert */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a critical alert..."
                  value={newAlert}
                  onChange={(e) => setNewAlert(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAlert()}
                  className="flex-1 border-rose-200 focus:border-rose-500"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={addAlert} 
                  disabled={!newAlert.trim()}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Alert List */}
              <div className="space-y-2">
                {handoff.criticalAlerts?.map((alert, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                    <span className="flex-1 text-sm text-rose-700">{alert}</span>
                    <button
                      onClick={() => removeAlert(index)}
                      className="text-rose-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!handoff.criticalAlerts || handoff.criticalAlerts.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No critical alerts
                  </p>
                )}
              </div>
            </div>

            {/* Equipment Status */}
            <div className="space-y-2">
              <Label htmlFor="equipment-status">Equipment Status</Label>
              <textarea
                id="equipment-status"
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Status of equipment, supplies, or technical issues..."
                value={handoff.equipmentStatus}
                onChange={(e) => setHandoff(prev => ({ ...prev, equipmentStatus: e.target.value }))}
              />
            </div>

            {/* Sign-out Notes */}
            <div className="space-y-2">
              <Label htmlFor="signout-notes" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Sign-out Notes
              </Label>
              <textarea
                id="signout-notes"
                rows={2}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Any additional notes for the incoming provider..."
                value={handoff.signOutNotes}
                onChange={(e) => setHandoff(prev => ({ ...prev, signOutNotes: e.target.value }))}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Complete Handoff
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Handoff summary badge for shift cards
export function HandoffIndicator({
  slotId,
  onClick
}: {
  slotId: string;
  onClick?: () => void;
}) {
  // TODO: Check if handoff exists for this slot
  const hasHandoff = false;

  if (!hasHandoff) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
    >
      <ClipboardList className="w-3 h-3" />
      Handoff
    </button>
  );
}
