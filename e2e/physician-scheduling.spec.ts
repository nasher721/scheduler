import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';

function fixture() {
  const providers = ['Patel', 'Chen', 'Morgan', 'Lee', 'Garcia', 'Kim', 'Singh', 'Wu'].map((name, index) => ({
    id: `test-doctor-${index}`, name: `Dr. ${name}`, email: `test-${index}@example.org`, role: 'CLINICIAN',
    targetWeekDays: 16, targetWeekendDays: 8, targetWeekNights: 8, targetWeekendNights: 4,
    skills: ['NEURO_CRITICAL', 'GENERAL_NEURO'], timeOffRequests: [], preferredDates: [],
    maxConsecutiveNights: 5, minDaysOffAfterNight: 1,
  }));
  const services = [ ['G20', 'DAY'], ['H22', 'DAY'], ['Akron', 'DAY'], ['Consults', 'CONSULTS'], ['Nights', 'NIGHT'], ['Jeopardy', 'JEOPARDY'] ];
  const slots = Array.from({ length: 28 }, (_, day) => services.map(([location, type], service) => ({
    id: `test-slot-${day}-${service}`, date: new Date(Date.UTC(2026, 8, 7 + day)).toISOString().slice(0, 10),
    type, providerId: service === 3 && day % 2 === 1 || service === 5 && day % 2 === 0 ? null : providers[(day + service) % providers.length].id,
    location, serviceLocation: location, locationGroup: location === 'Akron' ? 'AKRON_UNIT' : 'MAIN_CAMPUS_UNIT',
    requiredSkill: 'NEURO_CRITICAL', priority: 1, servicePriority: service < 3 ? 'CRITICAL' : 'STANDARD',
    isWeekendLayout: day % 7 >= 5, secondaryProviderIds: [],
  }))).flat();
  return { providers, slots, currentUser: { ...providers[0], role: 'ADMIN', name: 'Test Scheduler' },
    startDate: '2026-09-07', numWeeks: 4, conflicts: [], scenarios: [], customRules: [], auditLog: [], history: [], historyIndex: -1,
    scheduleViewport: { surfaceView: 'calendar', calendarPresentationMode: 'grid', currentWeekOffset: 0, shiftTypeFilter: 'all', providerSearchTerm: '', showConflictsOnly: false, showUnfilledOnly: false },
  };
}

async function openSchedule(page: Page) {
  await page.route(/https?:\/\/[^/]*supabase\.[^/]+\//, (route) => route.abort());
  await page.route('http://127.0.0.1:5173/api/**', (route) => route.fulfill({ json: { state: null, alerts: [], notifications: [], requests: [], providers: [], events: [] } }));
  await page.addInitScript((state) => {
    // Only seed a new isolated test browser; reload must retain edits for verification.
    if (!localStorage.getItem('nicu-schedule-store-v4')) localStorage.setItem('nicu-schedule-store-v4', JSON.stringify({ state, version: 0 }));
    localStorage.setItem('nicu-scheduler-tour-seen', 'true');
    localStorage.setItem('nicu-availability-panel-open', 'false');
  }, fixture());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coverage, clearly.' })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
}

async function captureWorkspace(page: Page, name: string) {
  // Exclude the development-only annotation widget from design artifacts.
  await page.getByRole('button', { name: 'Enter annotation mode', exact: true }).evaluateAll((buttons) => buttons.forEach((button) => { (button as HTMLElement).style.visibility = 'hidden'; }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/scheduler-${name}-viewport.png` });
  await page.screenshot({ path: `test-results/scheduler-${name}.png`, fullPage: true });
}

test('desktop views, compound filters and keyboard shift editing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openSchedule(page);
  await captureWorkspace(page, 'desktop');
  await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByRole('button', { name: /Monday, September 7,.*View day roster/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Nights Dr. Garcia/ }).click();
  await expect(page.getByRole('dialog', { name: 'Night Shift' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByText('October 2026', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await page.getByLabel('Jump to date').fill('2026-09-07');
  await page.getByLabel('Filter providers by name').fill('Dr. Patel');
  await page.getByLabel('Shift type filter').selectOption('NIGHT');
  await expect(page.getByRole('button', { name: /Dr. Chen/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByLabel('Jump to date')).toHaveValue('2026-09-07');
  await expect(page.getByLabel('Filter providers by name')).toHaveValue('');
  await expect(page.getByLabel('Shift type filter')).toHaveValue('all');
  const shift = page.getByRole('button', { name: /G20.*2026-09-07|Sep.*7.*G20|G20.*Sep.*7/ }).first();
  await shift.focus();
  await shift.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const openShift = page.getByRole('button', { name: 'Consults, 2026-09-08: Assign open shift', exact: true });
  await openShift.click();
  await page.getByRole('dialog').getByRole('button', { name: /Dr. Wu/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Consults, 2026-09-08: Dr. Wu', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Consults, 2026-09-08: Dr. Wu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(openShift).toBeVisible();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  expect(errors).toEqual([]);
});

test('Excel export is a readable workbook and import can be cancelled or applied and rolled back', async ({ page }) => {
  await openSchedule(page);
  await page.getByRole('button', { name: 'Export schedule', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Excel Workbook/i }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).toBeTruthy();
  const workbook = XLSX.read(await readFile(file!), { type: 'buffer' });
  expect(workbook.SheetNames.length).toBeGreaterThan(0);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
  expect(rows.filter((row) => typeof row['Month '] === 'number')).toHaveLength(28);
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
  await page.locator('input[type=file]').setInputFiles({ name: 'roundtrip.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await readFile(file!) });
  await expect(page.getByRole('dialog', { name: 'Review your workbook' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply import', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const inputBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(inputBook, XLSX.utils.json_to_sheet([{ Date: '2026-09-07', G20: 'Dr. Chen', H22: 'Dr. Morgan', Akron: 'Dr. Patel', Night: 'Dr. Garcia', Consults: 'Dr. Lee', Jeopardy: 'Dr. Wu' }]), 'Schedule');
  const buffer = XLSX.write(inputBook, { type: 'buffer', bookType: 'xlsx' });
  await page.locator('input[type=file]').setInputFiles({ name: 'team-schedule.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByRole('dialog', { name: 'Review your workbook' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'team-schedule.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await page.getByRole('button', { name: 'Apply import', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /G20, 2026-09-07: Dr. Chen/ })).toBeVisible();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: /Roll back last import/i }).click();
  await expect(page.getByText('Import rolled back', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /G20, 2026-09-07: Dr. Patel/ })).toBeVisible();
});

test('mobile layout contains the calendar and supports keyboard navigation drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSchedule(page);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await captureWorkspace(page, 'mobile');
});


test('print keeps physician assignments visible in week and month views', async ({ page }) => {
  await openSchedule(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: /G20, 2026-09-07: Dr. Patel/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View 28 open shifts' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: /Monday, September 7,.*View day roster/ })).toBeVisible();
});
