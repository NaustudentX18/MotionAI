import { test, expect } from '@playwright/test';

test.describe('Mobile PWA shell', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('loads compact mobile workspace without desktop header clutter', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Drive Sync')).toHaveCount(0);
    await expect(page.getByText('Export PDF')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ask AI' }).first()).toBeVisible();
  });

  test('manifest is served for install', async ({ page }) => {
    const res = await page.request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.permissions).toContain('microphone');
  });
});
