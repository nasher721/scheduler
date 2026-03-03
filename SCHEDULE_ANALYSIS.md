# Neuro ICU Schedule Spreadsheet Analysis

## Executive Summary

Based on my analysis of the `MASTER_NEW_CALENDAR_NICU_Staff_SCHEDULE.xlsx` spreadsheet, I've identified several opportunities to enhance the Neuro ICU Scheduler application to better support your scheduling workflow. The current spreadsheet manages **368 days** of scheduling across **9 shift types** for approximately **18 providers**.

---

## Current Spreadsheet Structure Analysis

### 1. Workbook Organization

| Sheet | Purpose | Rows | Key Content |
|-------|---------|------|-------------|
| **2026 Sch** | Main schedule (2026) | 381 | Daily assignments by shift type |
| **Staff 2026 #s** | Staff targets & tracking | 84 | FTE goals, deficits, first/second half splits |
| **2026 RD changes** | Change log | 1 | Manual swap notes |
| **2025 First Half** | Historical schedule | 333 | Jan-Jun 2025 data |
| **2025 second half** | Historical schedule | 221 | Jul-Dec 2025 data |
| **Staff 2025 #s** | 2025 targets | 62 | FTE tracking with formulas |
| **Swap Tracker** | Swap management | 56 | Pending/approved swaps |

### 2. Shift Types Identified

| Column | Type | 2026 Assignments | Description |
|--------|------|------------------|-------------|
| G20 | DAY | 380 | Primary day unit |
| H22 | DAY | 268 | Secondary day unit |
| Akron | DAY | 373 | Off-site day unit |
| Nights | NIGHT | 266 | Night shifts |
| Consults | CONSULTS | 58 | Consult service |
| AMET | NMET | 0 | Airway/Metabolic (unused) |
| Jeopardy | JEOPARDY | 16 | Backup coverage |
| Recovery | RECOVERY | 112 | Post-call recovery days |
| Vacations | VACATION | 79 | Time off tracking |

### 3. Provider Workload Summary (2026)

| Provider | Total Shifts | G20 | Akron | H22 | Nights | Recovery | Notes |
|----------|--------------|-----|-------|-----|--------|----------|-------|
| Dani | 167 | 16 | 75 | 15 | 25 | 23 | Highest workload |
| Bolt | 159 | 26 | 32 | 47 | 28 | 14 | Heavy nights |
| Rosales | 154 | 36 | 45 | 19 | 28 | 21 | Balanced |
| Bates | 149 | 31 | 18 | 24 | 23 | 14 | |
| Barron | 147 | 44 | 19 | 29 | 29 | 19 | |
| Lynch | 135 | 36 | 37 | 30 | 0 | 0 | No nights |
| Hassett | 127 | 28 | 27 | 10 | 24 | 14 | |
| Gomes | 122 | 39 | 12 | 13 | 27 | 23 | |
| Goswami | 93 | 22 | 14 | 15 | 28 | 14 | Maternity |
| Sabharwal | 80 | 32 | 27 | 15 | 0 | 0 | No nights |
| BB | 55 | 23 | 14 | 4 | 14 | 0 | |
| Asher | 52 | 8 | 16 | 14 | 14 | 0 | |
| CC | 33 | 14 | 2 | 10 | 7 | 0 | |

### 4. FTE Targets (2026)

| Provider | Week FTE | Weekend FTE | Status |
|----------|----------|-------------|--------|
| Barron | 25 | 14 | On target |
| Bolt | 28 | 14 | On target |
| Villamizar Rosales | 28 | 14 | On target |
| Dani | 22 | 14 | On target |
| Gomes | 17 | 14 | On target |
| Lynch | 19 | 12 | On target |
| Goswami | 16 | 8 | Maternity |
| Sabharwal | 13 | 12 | FTE with no nights |
| Bates | 15 | 7 | Paternity |
| Hassett | 14 | 14 | On target |
| Asher | 12 | 6 | |
| BB | 12 | 6 | |
| CC | 7 | 4 | |
| Mitchell | 6 | 3 | |
| EM | 12 | 6 | |

---

## Identified Pain Points

### 1. **Manual Data Entry & Validation**
- Dates entered as both month labels AND individual dates
- Provider names have inconsistencies (e.g., "lynch" vs "Lynch", "Hasset" vs "Hassett")
- No validation prevents double-booking or constraint violations
- Recovery days manually tracked separately from night assignments

### 2. **Workload Tracking is Reactive**
- FTE deficits calculated via formulas after scheduling
- No real-time visibility into who is over/under target
- Week/weekend splits require manual calculation

### 3. **Swap Management is Fragmented**
- Swaps tracked in separate "Swap Tracker" sheet
- Approval status often blank ("waiting to hear back")
- No linkage between swap requests and schedule changes
- No automatic validation of swap eligibility

### 4. **Multi-Provider Cells**
- Cells contain "&" separated names (e.g., "Bates & Hassett")
- Makes counting and analysis difficult
- No clear primary assignee

### 5. **Holiday Tracking is Manual**
- Holiday assignments noted in comments/notes
- No systematic holiday fairness tracking
- Thanksgiving, Christmas, New Year assignments scattered

### 6. **Cross-Unit Coordination**
- G20, H22, Akron treated separately but providers may work across units
- No visibility into cross-campus same-day restrictions

---

## Application Enhancement Recommendations

### HIGH PRIORITY

#### 1. **Smart Import with AI Column Mapping** ✅ (Partially Exists)
**Current State:** Basic import with header aliasing  
**Enhancement:** 
- Detect and split multi-provider cells ("&" separator)
- Auto-correct common name misspellings
- Flag potential duplicates (case-insensitive matching)
- Parse month header rows as metadata, not data

```typescript
// New feature: Multi-provider cell parsing
interface ParsedAssignment {
  primaryProvider: string;
  secondaryProviders?: string[];
  assignmentType: 'solo' | 'shared' | 'backup';
}
```

#### 2. **Real-Time FTE Dashboard**
**New Feature:** Live deficit tracking
- Visual indicator when provider is over/under target
- Week vs Weekend breakdown
- Color coding: Green (on target), Yellow (approaching limit), Red (over target)
- Projected totals based on current assignments

#### 3. **Integrated Swap Management System**
**New Feature:** Replace spreadsheet swap tracker
- Request workflow: Provider A requests swap with Provider B
- Approval chain: Both providers + scheduler approval
- Automatic eligibility checking (skills, credentials, time-off conflicts)
- Auto-update schedule upon approval
- Audit trail of all swaps

```typescript
interface SwapRequest {
  id: string;
  requestorId: string;
  targetProviderId: string;
  fromDate: string;
  toDate: string;
  fromShiftType: ShiftType;
  toShiftType: ShiftType;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}
```

#### 4. **Holiday Fairness Tracker**
**New Feature:** Ensure equitable holiday distribution
- Track Thanksgiving, Christmas, New Year assignments
- Visual indicator of holiday "debt" (who's worked recent holidays)
- Suggest providers who haven't worked holidays
- Annual holiday summary report

### MEDIUM PRIORITY

#### 5. **Recovery Day Auto-Assignment**
**Enhancement:** Link recovery days to night shifts
- When night shift assigned, auto-suggest recovery day
- Validate minDaysOffAfterNight constraint
- Visual linkage between night and recovery in calendar

#### 6. **Provider-Specific Scheduling Rules**
**Enhancement:** Per-provider constraints
- Sabharwal: "FTE with no nights" → Enforce no night assignments
- Goswami: Maternity leave → Block date ranges
- Lynch: Post-call recovery preferences

#### 7. **Split-Shift Support**
**Enhancement:** Handle "&" assignments properly
- Primary/secondary provider distinction
- Count both providers toward FTE (fractional)
- Clear indication of shared responsibility

#### 8. **Multi-Sheet Export**
**Enhancement:** Match current Excel structure
- Sheet 1: Schedule (identical to current format)
- Sheet 2: Staff FTE tracking with formulas
- Sheet 3: Swap tracker with status
- Sheet 4: Holiday summary

### LOW PRIORITY

#### 9. **Historical Comparison**
**New Feature:** Year-over-year analysis
- Import 2025 data for baseline
- Compare provider load distributions
- Identify scheduling pattern improvements

#### 10. **Conflict Detection**
**Enhancement:** Proactive validation
- Warn when assigning provider who worked adjacent day/night
- Flag consecutive night violations
- Alert when approaching max shifts per week

---

## Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)
1. Enhance import to handle multi-provider cells
2. Add name normalization/correction
3. Fix case-sensitivity in provider matching

### Phase 2: FTE Dashboard (2 weeks)
1. Real-time deficit calculation
2. Visual indicators in ProviderManager
3. Export with FTE formulas

### Phase 3: Swap System (3-4 weeks)
1. Swap request UI
2. Approval workflow
3. Email notifications
4. Auto-update schedule

### Phase 4: Holiday & Recovery (2 weeks)
1. Holiday tracking
2. Recovery day auto-linkage
3. Fairness reporting

---

## Quick Wins (Immediate Implementation)

### 1. **Add Missing Shift Type: AMET/NMET**
The spreadsheet has an AMET column but it's unused. The app already has NMET support.

### 2. **Normalize Provider Names on Import**
```typescript
const normalizeProviderName = (name: string): string => {
  const corrections: Record<string, string> = {
    'lynch': 'Lynch',
    'hasset': 'Hassett',
    'sabarwhal': 'Sabharwal',
  };
  return corrections[name.toLowerCase()] || name;
};
```

### 3. **Add "No Nights" Flag to Provider**
For Sabharwal and similar providers:
```typescript
interface Provider {
  // ... existing fields
  schedulingRestrictions?: {
    noNights?: boolean;
    noWeekends?: boolean;
    noHolidays?: boolean;
  };
}
```

---

## Spreadsheet-to-App Feature Mapping

| Spreadsheet Feature | App Equivalent | Gap |
|---------------------|----------------|-----|
| Daily shift columns | Shift slots by type | ✅ Covered |
| Month header rows | Date grouping in UI | ⚠️ Visual only |
| Staff 2026 #s formulas | Provider targets + deficit calculation | ⚠️ No real-time view |
| Swap Tracker sheet | Shift requests feature | ⚠️ No approval workflow |
| Notes column | Provider notes field | ❌ Not implemented |
| FTE deficit formulas | Auto-calculate deficits | ⚠️ Export only, no live view |
| Holiday tracking | Manual vacation requests | ❌ No holiday fairness tracking |
| Multi-provider cells | Single provider per slot | ❌ No split-shift support |

---

## Conclusion

The current spreadsheet manages complex scheduling requirements effectively but relies heavily on manual validation and reactive tracking. The Neuro ICU Scheduler app already covers **~70%** of the spreadsheet functionality. Key enhancements needed:

1. **Swap management workflow** (highest impact)
2. **Real-time FTE dashboard** (prevents over-scheduling)
3. **Multi-provider cell support** (matches existing practice)
4. **Holiday fairness tracking** (ensures equity)
5. **Enhanced import with validation** (reduces data entry errors)

These improvements would enable a complete transition from spreadsheet to application-based scheduling while maintaining the familiar output format.
