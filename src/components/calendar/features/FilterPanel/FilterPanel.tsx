/**
 * FilterPanel Component
 * 
 * Advanced filtering panel with presets, fuzzy search, and multi-select.
 * Part of Phase 1: UX & Accessibility
 */

import { useState, useCallback } from 'react';
import { useScheduleStore, type ServicePriority, type ShiftType } from '@/store';
import { useFilters, DEFAULT_PRESETS, type FilterPreset } from '../../hooks/useFilters';
import { useAnnounce } from '../../hooks/useAnnounce';
import { formatPriority, formatShiftType } from '../../utils/accessibilityUtils';
import {
  Search,
  Filter,
  X,
  Save,
  Trash2,
  Check,
  AlertCircle,
  User,
  Calendar,
  Moon,
  Clock,
  Sun,
  Sparkles,
  AlertTriangle,
  Activity,
  Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const SHIFT_TYPE_ICONS: Record<ShiftType, typeof Sun> = {
  DAY: Sun,
  NIGHT: Moon,
  NMET: Sparkles,
  JEOPARDY: AlertTriangle,
  RECOVERY: Activity,
  CONSULTS: Stethoscope,
  VACATION: Clock
};

const PRIORITY_COLORS: Record<ServicePriority, string> = {
  CRITICAL: 'bg-rose-100 text-rose-700 border-rose-200',
  STANDARD: 'bg-amber-100 text-amber-700 border-amber-200',
  FLEXIBLE: 'bg-slate-100 text-slate-600 border-slate-200'
};

const PRESET_ICONS: Record<string, typeof Filter> = {
  AlertCircle,
  User,
  Calendar,
  Moon,
  Filter
};

export function FilterPanel({ isOpen, onClose, className }: FilterPanelProps) {
  const { providers, slots } = useScheduleStore();
  const {
    filters,
    filteredSlots,
    activeFilterCount,
    activePresetId,
    savedPresets,
    updateFilter,
    applyPreset,
    clearFilters
  } = useFilters();
  
  const { announceFilterChange } = useAnnounce();
  const [activeTab, setActiveTab] = useState<'filters' | 'presets'>('filters');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Get unique locations from slots
  const locations = [...new Set(slots.map(s => s.serviceLocation).filter(Boolean))];

  const handleClearFilters = useCallback(() => {
    clearFilters();
    announceFilterChange(0, slots.length);
  }, [clearFilters, slots.length, announceFilterChange]);

  const handleApplyPreset = useCallback((preset: FilterPreset) => {
    applyPreset(preset);
    announceFilterChange(
      Object.values(preset.filters).filter(v => 
        Array.isArray(v) ? v.length > 0 : v !== 'all' && v !== ''
      ).length,
      filteredSlots.length
    );
  }, [applyPreset, filteredSlots.length, announceFilterChange]);

  const handleSavePreset = useCallback(() => {
    if (presetName.trim()) {
      setIsSavingPreset(false);
      setPresetName('');
    }
  }, [presetName]);

  if (!isOpen) return null;

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Filters</h2>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close filters">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('filters')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors',
            activeTab === 'filters'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-500 hover:text-slate-700'
          )}
          aria-selected={activeTab === 'filters'}
          role="tab"
        >
          Filters
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors',
            activeTab === 'presets'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-500 hover:text-slate-700'
          )}
          aria-selected={activeTab === 'presets'}
          role="tab"
        >
          Presets
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'filters' ? (
          <div className="p-4 space-y-6">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="calendar-search" className="text-sm font-medium">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="calendar-search"
                  type="text"
                  placeholder="Providers, locations..."
                  value={filters.searchTerm}
                  onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  className="pl-9"
                />
                {filters.searchTerm && (
                  <button
                    onClick={() => updateFilter('searchTerm', '')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Type at least 3 characters to search
              </p>
            </div>

            <Separator />

            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Status</Label>
              <RadioGroup
                value={filters.status}
                onValueChange={(value) => updateFilter('status', value as typeof filters.status)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="status-all" />
                  <Label htmlFor="status-all" className="text-sm font-normal cursor-pointer">
                    All shifts
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filled" id="status-filled" />
                  <Label htmlFor="status-filled" className="text-sm font-normal cursor-pointer">
                    Filled only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unfilled" id="status-unfilled" />
                  <Label htmlFor="status-unfilled" className="text-sm font-normal cursor-pointer">
                    Unfilled only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="critical" id="status-critical" />
                  <Label htmlFor="status-critical" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                    Critical unfilled
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Priority Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Priority</Label>
              <div className="space-y-2">
                {(['CRITICAL', 'STANDARD', 'FLEXIBLE'] as ServicePriority[]).map((priority) => (
                  <div key={priority} className="flex items-center space-x-2">
                    <Checkbox
                      id={`priority-${priority}`}
                      checked={filters.priorities.includes(priority)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateFilter('priorities', [...filters.priorities, priority]);
                        } else {
                          updateFilter('priorities', filters.priorities.filter(p => p !== priority));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`priority-${priority}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2"
                    >
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', PRIORITY_COLORS[priority])}>
                        {formatPriority(priority)}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Shift Type Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Shift Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['DAY', 'NIGHT', 'NMET', 'JEOPARDY', 'RECOVERY', 'CONSULTS', 'VACATION'] as ShiftType[]).map((type) => {
                  const Icon = SHIFT_TYPE_ICONS[type];
                  return (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={filters.shiftTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateFilter('shiftTypes', [...filters.shiftTypes, type]);
                          } else {
                            updateFilter('shiftTypes', filters.shiftTypes.filter(t => t !== type));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`type-${type}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                        {formatShiftType(type)}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Provider Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Providers ({filters.providers.length} selected)
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {providers.map((provider) => (
                  <div key={provider.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`provider-${provider.id}`}
                      checked={filters.providers.includes(provider.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateFilter('providers', [...filters.providers, provider.id]);
                        } else {
                          updateFilter('providers', filters.providers.filter(p => p !== provider.id));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`provider-${provider.id}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2 truncate"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                        {provider.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{provider.name}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Results count */}
            <div className="pt-4 border-t">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold">{filteredSlots.length}</span> of{' '}
                <span className="font-semibold">{slots.length}</span> shifts
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Save current as preset */}
            {activeFilterCount > 0 && !activePresetId && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                {!isSavingPreset ? (
                  <button
                    onClick={() => setIsSavingPreset(true)}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                  >
                    <Save className="w-4 h-4" />
                    Save current filters as preset
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsSavingPreset(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preset list */}
            <div className="space-y-2">
              {savedPresets.map((preset) => {
                const Icon = PRESET_ICONS[preset.icon] || Filter;
                const isActive = activePresetId === preset.id;
                
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium text-sm',
                          isActive ? 'text-primary' : 'text-slate-900'
                        )}>
                          {preset.name}
                        </span>
                        {isActive && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      {preset.description && (
                        <p className="text-xs text-slate-500 truncate">
                          {preset.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t flex justify-between items-center">
        {activeFilterCount > 0 ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear all ({activeFilterCount})
            </Button>
            <Button size="sm" onClick={onClose}>
              Show {filteredSlots.length} shifts
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onClose} className="w-full">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

// Compact filter chips display
export function FilterChips({ className }: { className?: string }) {
  const { filters, updateFilter, clearFilters, providers, activeFilterCount } = useFilters();

  if (activeFilterCount === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {/* Status chip */}
      {filters.status !== 'all' && (
        <Badge variant="secondary" className="flex items-center gap-1">
          {filters.status === 'critical' ? 'Critical Unfilled' : filters.status}
          <button
            onClick={() => updateFilter('status', 'all')}
            className="ml-1 hover:text-slate-900"
            aria-label="Remove status filter"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}

      {/* Priority chips */}
      {filters.priorities.map((priority) => (
        <Badge key={priority} variant="secondary" className="flex items-center gap-1">
          {formatPriority(priority)}
          <button
            onClick={() => updateFilter('priorities', filters.priorities.filter(p => p !== priority))}
            className="ml-1 hover:text-slate-900"
            aria-label={`Remove ${priority} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {/* Provider chips */}
      {filters.providers.slice(0, 3).map((providerId) => {
        const provider = providers.find(p => p.id === providerId);
        return (
          <Badge key={providerId} variant="secondary" className="flex items-center gap-1">
            {provider?.name || providerId}
            <button
              onClick={() => updateFilter('providers', filters.providers.filter(p => p !== providerId))}
              className="ml-1 hover:text-slate-900"
              aria-label={`Remove ${provider?.name} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        );
      })}
      {filters.providers.length > 3 && (
        <Badge variant="secondary">
          +{filters.providers.length - 3} more
        </Badge>
      )}

      {/* Search term chip */}
      {filters.searchTerm && (
        <Badge variant="secondary" className="flex items-center gap-1">
          &quot;{filters.searchTerm}&quot;
          <button
            onClick={() => updateFilter('searchTerm', '')}
            className="ml-1 hover:text-slate-900"
            aria-label="Remove search filter"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}

      {/* Clear all button */}
      <button
        onClick={clearFilters}
        className="text-xs text-slate-500 hover:text-slate-700 underline"
      >
        Clear all
      </button>
    </div>
  );
}

// Filter toggle button for toolbar
export function FilterToggleButton({ 
  isActive, 
  onClick,
  activeCount 
}: { 
  isActive: boolean; 
  onClick: () => void;
  activeCount: number;
}) {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="relative"
      aria-expanded={isActive}
      aria-haspopup="true"
    >
      <Filter className="w-4 h-4 mr-2" />
      Filters
      {activeCount > 0 && (
        <span className="ml-2 px-1.5 py-0.5 bg-primary-foreground text-primary rounded-full text-xs">
          {activeCount}
        </span>
      )}
    </Button>
  );
}
