import { test, expect } from '@playwright/test';

test.describe('Meeting parser UI', () => {
  test('previews selectable tasks and creates a task page', async ({ page }) => {
    await page.route('**/api/ai/meeting-parser', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: ['Launch blockers reviewed'],
          tasks: [
            { title: 'Send launch checklist', assignee: 'Jake', dueDate: 'Tomorrow', priority: 'high' },
            { title: 'Book design review', assignee: 'Sam', dueDate: 'Friday', priority: 'medium' },
          ],
          source: 'mocked-e2e',
          keysReturned: false,
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const desktopButton = page.getByRole('button', { name: /Desktop/i });
    if (await desktopButton.isVisible().catch(() => false)) {
      await desktopButton.click();
    }

    await page.getByRole('button', { name: /Meeting AI/i }).click();
    await expect(page.getByRole('heading', { name: /Meeting notes to tasks/i })).toBeVisible();

    await page.getByPlaceholder(/Paste meeting notes/i).fill('Jake will send launch checklist by tomorrow. Sam will book design review by Friday.');
    await page.getByRole('button', { name: /Parse meeting notes/i }).click();

    await expect(page.getByText('Send launch checklist', { exact: true })).toBeVisible();
    await expect(page.getByText('Book design review', { exact: true })).toBeVisible();

    await page.getByLabel(/Book design review/i).uncheck();
    await page.getByRole('button', { name: /Create task page/i }).click();

    await expect(page.getByText(/Applied 1 selected task/i)).toBeVisible();
    await expect(page.locator('nav').getByText(/Meeting tasks/i)).toBeVisible({ timeout: 10_000 });
  });
});
