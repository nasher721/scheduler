/**
 * useFilters Hook
 * 
 * Manages calendar filtering logic with support for presets,
 * fuzzy search, and active filter tracking.
 * Part of Phase 1: UX & Accessibility
 */

import { useState, useMemo, useCallback } from 'react';
import { useScheduleStore, type ServicePriority, type ShiftType } from '@/store';
import Fuse from 'fuse.js';
import type { CalendarFilters, FilterPreset } from '@/types/calendar';

export const DEFAULT_FILTERS: CalendarFilters = {
  providers: [],
  locations: [],
  priorities: [],
  shiftTypes: [],
  dateRange: { start: null, end: null },
  status: 'all',
  searchTerm: ''
};

export const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'critical-unfilled',
    name: 'Critical Unfilled',
    icon: 'AlertCircle',
    description: 'Show all critical priority shifts that need coverage',
    filters: {
      providers: [],
      locations: [],
      priorities: ['CRITICAL'],
      shiftTypes: [],
      dateRange: { start: null, end: null },
      status: 'unfilled',
      searchTerm: ''
    }
  },
  {
    id: 'my-shifts',
    name: 'My Shifts',
    icon: 'User',
    description: 'Show only your assigned shifts',
    filters: {
      providers: [], // Will be populated with current user
      locations: [],
      priorities: [],
      shiftTypes: [],
      dateRange: { start: null, end: null },
      status: 'all',
      searchTerm: ''
    }
  },
  {
    id: 'weekend-coverage',
    name: 'Weekend Coverage',
    icon: 'Calendar',
    description: 'Show weekend shifts only',
    filters: {
      providers: [],
      locations: [],
      priorities: [],
      shiftTypes: [],
      dateRange: { start: null, end: null },
      status: 'all',
      searchTerm: ''
    }
  },
  {
    id: 'night-shifts',
    name: 'Night Shifts',
    icon: 'Moon',
    description: 'Show NIGHT and NMET shifts',
    filters: {
      providers: [],
      locations: [],
      priorities: [],
      shiftTypes: ['NIGHT', 'NMET'],
      dateRange: { start: null, end: null },
      status: 'all',
      searchTerm: ''
    }
  }
];

export function useFilters() {
  const { slots, providers, currentUser } = useScheduleStore();
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(DEFAULT_PRESETS);

  // Setup fuzzy search for providers
  const providerFuse = useMemo(() => {
    return new Fuse(providers, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'email', weight: 1 },
        { name: 'skills', weight: 1 }
      ],
      threshold: 0.3,
      includeScore: true
    });
  }, [providers]);

  // Setup fuzzy search for locations
  const locations = useMemo(() => {
    const allLocations = new Set(slots.map(s => s.serviceLocation).filter(Boolean));
    return Array.from(allLocations);
  }, [slots]);

  const locationFuse = useMemo(() => {
    return new Fuse(locations, {
      threshold: 0.3
    });
  }, [locations]);

  // Apply filters to slots
  const filteredSlots = useMemo(() => {
    return slots.filter(slot => {
      // Provider filter
      if (filters.providers.length > 0) {
        if (!slot.providerId || !filters.providers.includes(slot.providerId)) {
          return false;
        }
      }

      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(slot.servicePriority)) {
        return false;
      }

      // Shift type filter
      if (filters.shiftTypes.length > 0 && !filters.shiftTypes.includes(slot.type)) {
        return false;
      }

      // Location filter (using search term or explicit filter)
      if (filters.locations.length > 0 && !filters.locations.includes(slot.serviceLocation)) {
        return false;
      }

      // Status filter
      if (filters.status === 'filled' && !slot.providerId) return false;
      if (filters.status === 'unfilled' && slot.providerId) return false;
      if (filters.status === 'critical') {
        if (slot.servicePriority !== 'CRITICAL' || slot.providerId) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange.start && slot.date < filters.dateRange.start) return false;
      if (filters.dateRange.end && slot.date > filters.dateRange.end) return false;

      // Search term (fuzzy search on provider names and locations)
      if (filters.searchTerm.length > 2) {
        const providerResults = providerFuse.search(filters.searchTerm);
        const locationResults = locationFuse.search(filters.searchTerm);
        
        const matchedProviders = providerResults.map(r => r.item.id);
        const matchedLocations = locationResults.map(r => r.item);
        
        const matchesProvider = slot.providerId && matchedProviders.includes(slot.providerId);
        const matchesLocation = matchedLocations.includes(slot.serviceLocation);
        
        if (!matchesProvider && !matchesLocation) {
          return false;
        }
      }

      return true;
    });
  }, [slots, filters, providerFuse, locationFuse]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.providers.length > 0) count++;
    if (filters.locations.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.shiftTypes.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.status !== 'all') count++;
    if (filters.searchTerm) count++;
    return count;
  }, [filters]);

  // Update a specific filter
  const updateFilter = useCallback(<K extends keyof CalendarFilters>(
    key: K,
    value: CalendarFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setActivePresetId(null); // Clear preset when manually changing filters
  }, []);

  // Apply a preset
  const applyPreset = useCallback((preset: FilterPreset) => {
    let filtersToApply = { ...preset.filters };
    
    // Special handling for "My Shifts" preset
    if (preset.id === 'my-shifts' && currentUser) {
      filtersToApply.providers = [currentUser.id];
    }
    
    setFilters(filtersToApply);
    setActivePresetId(preset.id);
  }, [currentUser]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setActivePresetId(null);
  }, []);

  // Save current filters as a preset
  const savePreset = useCallback((name: string, icon: string = 'Filter') => {
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      filters: { ...filters },
      isDefault: false
    };
    
    setSavedPresets(prev => [...prev, newPreset]);
    return newPreset.id;
  }, [filters]);

  // Delete a saved preset
  const deletePreset = useCallback((presetId: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId));
    if (activePresetId === presetId) {
      setActivePresetId(null);
    }
  }, [activePresetId]);

  // Get filter summary for display
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    
    if (filters.status !== 'all') {
      parts.push(filters.status === 'critical' ? 'Critical only' : `${filters.status} only`);
    }
    
    if (filters.priorities.length === 1) {
      parts.push(`${filters.priorities[0]} priority`);
    } else if (filters.priorities.length > 1) {
      parts.push(`${filters.priorities.length} priorities`);
    }
    
    if (filters.providers.length === 1) {
      const provider = providers.find(p => p.id === filters.providers[0]);
      parts.push(provider?.name || '1 provider');
    } else if (filters.providers.length > 1) {
      parts.push(`${filters.providers.length} providers`);
    }
    
    if (filters.searchTerm) {
      parts.push(`"${filters.searchTerm}"`);
    }
    
    return parts;
  }, [filters, providers]);

  return {
    filters,
    filteredSlots,
    activeFilterCount,
    activePresetId,
    savedPresets,
    filterSummary,
    updateFilter,
    applyPreset,
    clearFilters,
    savePreset,
    deletePreset
  };
}

// Helper hook for filter chip display
export function useFilterChips() {
  const { filters, updateFilter, clearFilters, providers } = useFilters();

  const chips = useMemo(() => {
    const result: Array<{ type: string; label: string; onRemove: () => void }> = [];

    // Status chip
    if (filters.status !== 'all') {
      result.push({
        type: 'status',
        label: filters.status === 'critical' ? 'Critical Unfilled' : `${filters.status}`,
        onRemove: () => updateFilter('status', 'all')
      });
    }

    // Priority chips
    filters.priorities.forEach(priority => {
      result.push({
        type: 'priority',
        label: priority,
        onRemove: () => updateFilter('priorities', filters.priorities.filter(p => p !== priority))
      });
    });

    // Provider chips
    filters.providers.forEach(providerId => {
      const provider = providers.find(p => p.id === providerId);
      result.push({
        type: 'provider',
        label: provider?.name || providerId,
        onRemove: () => updateFilter('providers', filters.providers.filter(p => p !== providerId))
      });
    });

    // Shift type chips
    filters.shiftTypes.forEach(type => {
      result.push({
        type: 'shiftType',
        label: type,
        onRemove: () => updateFilter('shiftTypes', filters.shiftTypes.filter(t => t !== type))
      });
    });

    // Search term chip
    if (filters.searchTerm) {
      result.push({
        type: 'search',
        label: `"${filters.searchTerm}"`,
        onRemove: () => updateFilter('searchTerm', '')
      });
    }

    return result;
  }, [filters, updateFilter, providers]);

  return { chips, clearFilters };
}
