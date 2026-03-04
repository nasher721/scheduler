import { saveScheduleState, loadScheduleState } from './src/lib/api';
import { createClient } from '@supabase/supabase-js';

async function test() {
  console.log("Saving state...");
  await saveScheduleState({
    providers: [
      {
        id: "p1",
        name: "Test Doctor",
        email: "test@doctor.org",
        role: "CLINICIAN",
        targetWeekDays: 10,
        targetWeekendDays: 4,
        targetWeekNights: 2,
        targetWeekendNights: 1,
        timeOffRequests: [],
        preferredDates: [],
        skills: [],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
        credentials: [],
        schedulingRestrictions: {}
      }
    ],
    slots: [
      {
        id: "s1",
        date: "2024-05-01",
        type: "DAY",
        providerId: "p1",
        isWeekendLayout: false,
        requiredSkill: "N/A",
        priority: "STANDARD",
        location: "NICU",
        secondaryProviderIds: [],
        isSharedAssignment: false
      }
    ],
    startDate: "2024-05-01",
    numWeeks: 4,
    scenarios: [],
    customRules: [],
    auditLog: []
  });

  console.log("Loading state...");
  const data = await loadScheduleState();
  console.log("Providers: ", data.state?.providers.length);
  console.log("Slots: ", data.state?.slots.length);
  console.log("StartDate: ", data.state?.startDate);
}
test().catch(console.error);
