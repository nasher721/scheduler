import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page has loaded
    await expect(page).toHaveTitle(/Neuro ICU Scheduler/i);
    
    // Check for main content
    await expect(page.locator('body')).toBeVisible();
  });

  test('API health check returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
  });

  test('API docs are accessible', async ({ page }) => {
    await page.goto('/api-docs');
    
    // Check that Swagger UI has loaded
    await expect(page.locator('.swagger-ui')).toBeVisible();
    await expect(page.locator('.title')).toContainText('Neuro ICU Scheduler API');
  });
});

test.describe('Responsive Design', () => {
  test('displays correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that content is visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays correctly on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    
    await expect(page.locator('body')).toBeVisible();
  });
});
