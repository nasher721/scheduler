# Learnings - Smart Schedule Button Implementation

## What Worked
- Created a single button component that combines auto-fill + optimize into one-click action
- Progress stages displayed in button: "Analyzing..." → "Optimizing..." → "Applying..."
- Auto-apply when confidence >= 0.8 and no hard violations
- Falls back to preview on error or low confidence
- Uses existing store actions (openChangePreviewWithMultiAgentResult)
- Uses existing cn() utility from @/lib/utils

## Key Patterns Used
- motion.button with whileHover/whileTap (framer-motion)
- Loading spinner with animated Loader2 icon
- Dynamic button styling based on stage
- useCallback for async handlers with proper dependencies

## Gotchas Fixed
- Removed unused applyAllAISuggestions from store destructuring (was causing TS error)
- Removed custom cn() function - used existing cn() from @/lib/utils instead
- Added type="button" to motion.button elements to satisfy existing LSP warnings

## Pre-existing Issues (Not Fixed)
- App.tsx has multiple LSP warnings about button type props (these existed before)
- Service worker has build error about 'assignWith' - pre-existing issue unrelated to this change

## Files Changed
- Created: src/components/AutoScheduleButton.tsx
- Modified: src/App.tsx (added import + button in toolbar)