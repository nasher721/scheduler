/**
 * Calendar Components
 * 
 * Enhanced calendar components across all phases:
 * 
 * Phase 4: Real-time Collaboration
 * - ActivityFeed, CommentsSystem, CursorOverlay, usePresence
 * 
 * Phase 5: AI Features
 * - AISuggestionsPanel, NaturalLanguageInterface, PredictiveAnalyticsDashboard
 * 
 * Features: ShiftComments, AssignmentPreview, SwapBoard, HandoffModal, TemplateLibrary
 * Hooks: usePresence, useKeyboardNavigation
 */

// ============================================================================
// Phase 4: Collaboration
// ============================================================================

export {
  ActivityFeed,
  type ActivityFeedProps
} from './collaboration/ActivityFeed';

export {
  CommentsSystem,
  type CommentsSystemProps
} from './collaboration/CommentsSystem';

export {
  CursorOverlay,
  AwarenessIndicator,
  useSmoothCursors,
  type CursorOverlayProps
} from './collaboration/CursorOverlay';

// ============================================================================
// Phase 5: AI Features
// ============================================================================

export {
  AISuggestionsPanel,
  type AISuggestionsPanelProps
} from './features/AI/AISuggestionsPanel';

export {
  NaturalLanguageInterface,
  type NaturalLanguageInterfaceProps
} from './features/AI/NaturalLanguageInterface';

export {
  PredictiveAnalyticsDashboard,
  type PredictiveAnalyticsDashboardProps
} from './features/AI/PredictiveAnalyticsDashboard';

// ============================================================================
// Hooks
// ============================================================================

export {
  usePresence,
  useUserPresence,
  type UsePresenceOptions,
  type UsePresenceReturn
} from './hooks/usePresence';

// ============================================================================
// Features
// ============================================================================

export {
  ShiftComments,
  CommentCount
} from './features/ShiftComments';
