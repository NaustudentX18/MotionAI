import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

const DEFAULT_SIGNALING_WS_URL = 'ws://localhost:3005';

function signalingHttpUrl(): string {
  const raw =
    process.env.PLAYWRIGHT_SIGNALING_URL ||
    process.env.VITE_SIGNALING_URL ||
    process.env.VITE_SIGNALING_URLS?.split(',')[0] ||
    DEFAULT_SIGNALING_WS_URL;

  return raw.trim().replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://').replace(/\/$/, '');
}

async function expectMotionAiAppAvailable(request: APIRequestContext) {
  let response;
  try {
    response = await request.get('/api/health', { timeout: 5_000, failOnStatusCode: false });
  } catch (error) {
    throw new Error(`MotionAI app is unavailable at PLAYWRIGHT_BASE_URL: ${String(error)}`);
  }

  if (!response.ok()) {
    throw new Error(`MotionAI app health check failed: GET /api/health returned HTTP ${response.status()}`);
  }

  const body = await response.json().catch(() => null);
  if (!body || body.status !== 'ok' || body.keysReturned !== false) {
    throw new Error(`MotionAI app health check returned an unexpected payload: ${JSON.stringify(body)}`);
  }
}

async function signalingAvailable(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get(signalingHttpUrl(), { timeout: 3_000, failOnStatusCode: false });
    return response.ok();
  } catch {
    return false;
  }
}

async function clearOriginStorage(page: Page) {
  await page.goto('/api/health');
  await page.evaluate(async () => {
    const deleteDatabase = async (name: string) => new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });

    localStorage.clear();
    sessionStorage.clear();

    const knownDatabases = [
      'motionai-ydoc',
      'motionai-ydoc-encrypted',
      'open_notion_workspace',
    ];
    const browserDatabaseNames = typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases())
          .map((db) => db.name)
          .filter((name): name is string => Boolean(name))
      : [];

    const databaseNames = new Set([
      ...knownDatabases,
      ...browserDatabaseNames.filter((name) => (
        name.startsWith('motionai-ydoc') ||
        name.startsWith('motionai-ydoc-encrypted') ||
        name === 'open_notion_workspace'
      )),
    ]);

    await Promise.all([...databaseNames].map(deleteDatabase));
  });
}

async function createCleanPage(browser: Browser, label: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[${label} console:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => console.error(`[${label} pageerror]`, error));

  await clearOriginStorage(page);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /Desktop/i }),
    `${label}: MotionAI shell did not render after app startup; if only the workspace loader is visible, this is an app/persistence hang`,
  ).toBeVisible({ timeout: 12_000 });
  return page;
}

test.describe('WebRTC Multi-Browser Sync E2E', () => {
  test('syncs edits between two browser contexts on the same page', async ({ browser, request }) => {
    await expectMotionAiAppAvailable(request);
    test.skip(
      !(await signalingAvailable(request)),
      `y-webrtc signaling server is unavailable at ${signalingHttpUrl()}; start it with "npm run signaling" or "npm run dev:all".`,
    );

    const uniqueTitle = `Sync-Test-${Date.now()}`;
    const browser1Text = `Browser 1 edit ${uniqueTitle}`;
    const browser2Text = `Browser 2 edit ${uniqueTitle}`;

    const page1 = await createCleanPage(browser, 'browser-1');

    await page1.getByRole('button', { name: /New Page/i }).click();
    const titleInput1 = page1.locator('input[placeholder="Untitled"]').first();
    await expect(titleInput1, 'browser-1: new page title input should be available').toBeVisible({ timeout: 10_000 });
    await titleInput1.fill(uniqueTitle);
    await titleInput1.press('Enter');

    await expect(
      page1.locator('nav').getByText(uniqueTitle, { exact: true }),
      'browser-1: new page title should be saved into the local CRDT page list before peer convergence checks',
    ).toBeVisible({ timeout: 10_000 });

    const page2 = await createCleanPage(browser, 'browser-2');
    const page2SidebarItem = page2.locator('nav').getByText(uniqueTitle, { exact: true });
    await expect(
      page2SidebarItem,
      'CRDT convergence failed: browser-2 did not receive browser-1 page metadata through WebRTC signaling',
    ).toBeVisible({ timeout: 20_000 });
    await page2SidebarItem.click();

    const editor1 = page1.locator('.ProseMirror').first();
    const editor2 = page2.locator('.ProseMirror').first();
    await expect(editor1, 'browser-1: editor should be visible on the synced page').toBeVisible({ timeout: 10_000 });
    await expect(editor2, 'browser-2: editor should be visible on the synced page').toBeVisible({ timeout: 10_000 });

    await editor1.click();
    await page1.keyboard.type(browser1Text);
    await expect(
      editor2,
      'CRDT convergence failed: browser-2 did not receive browser-1 editor content',
    ).toContainText(browser1Text, { timeout: 20_000 });

    await editor2.click();
    await page2.keyboard.press('End');
    await page2.keyboard.press('Enter');
    await page2.keyboard.type(browser2Text);
    await expect(
      editor1,
      'CRDT convergence failed: browser-1 did not receive browser-2 editor content',
    ).toContainText(browser2Text, { timeout: 20_000 });

    await page1.context().close();
    await page2.context().close();
  });
});
