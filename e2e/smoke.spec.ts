import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads without crashing', async ({ page }) => {
    await page.goto('/');
    // Wait for app to be interactive
    await page.waitForLoadState('networkidle');
    // Check title or main content exists
    await expect(page.locator('body')).toBeVisible();
  });

  test('main UI elements are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Check main structural elements exist (adjust selectors based on actual app)
    const mainContent = page.locator('main, [role="main"], #root');
    await expect(mainContent.first()).toBeVisible();
  });
});
