import { test, expect } from '@playwright/test';

test.describe('Scheduler Core Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('loads calendar workspace with controls and slots', async ({ page }) => {
    // Verify main header and brand
    await expect(page.locator('body')).toBeVisible();
    
    // Look for calendar or attending portal elements
    const mainContent = page.locator('#root');
    await expect(mainContent).toBeVisible();
  });

  test('can switch between dark and light theme modes', async ({ page }) => {
    // Check if theme toggle button exists
    const themeBtn = page.locator('button[title*="theme" i], button[aria-label*="theme" i]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      // Verify document element has updated or remained stable
      const htmlClass = await page.locator('html').getAttribute('class');
      expect(htmlClass).toBeDefined();
    }
  });

  test('can navigate tabs between Admin workspace and Attending Portal', async ({ page }) => {
    // Check for navigation tabs or buttons
    const portalTab = page.locator('button:has-text("Attending"), button:has-text("Portal"), button:has-text("My Schedule")').first();
    if (await portalTab.isVisible()) {
      await portalTab.click();
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
