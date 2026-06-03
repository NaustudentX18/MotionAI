/**
 * Captures README / splash showcase images from a running MotionAI dev server.
 * Usage: PLAYWRIGHT_BASE_URL=http://localhost:3000 node scripts/capture-readme-media.mjs
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const outDir = path.resolve('docs/media');

async function waitForApp(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root && root.childElementCount > 0;
    },
    { timeout: 90_000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function dismissOverlays(page) {
  for (const name of [/not now/i, /dismiss/i, /skip/i, /got it/i, /close/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 1200 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

async function ensureDesktop(page) {
  const desktop = page.getByRole('button', { name: /^Desktop$/i });
  if (await desktop.isVisible().catch(() => false)) {
    await desktop.click();
    await page.waitForTimeout(600);
  }
}

async function openHub(page) {
  const hub = page.getByRole('button', { name: /MotionAI Portal/i });
  if (await hub.isVisible().catch(() => false)) {
    await hub.click();
    await page.waitForTimeout(1500);
  }
}

async function openSettings(page) {
  const settings = page.locator('button[title*="Settings"], button').filter({ has: page.locator('svg') }).first();
  const byTitle = page.locator('button').filter({ hasText: '' });
  const gear = page.locator('header button').filter({ has: page.locator('svg.lucide-settings, svg') }).last();
  if (await page.getByRole('button', { name: /settings/i }).first().isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /settings/i }).first().click();
  } else {
    await page.evaluate(() => window.dispatchEvent(new Event('open-settings')));
  }
  await page.waitForTimeout(1200);
  await page.getByRole('heading', { name: /settings/i }).first().waitFor({ timeout: 8000 }).catch(() => {});
}

async function capture() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // Desktop hub
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await waitForApp(page);
    await dismissOverlays(page);
    await ensureDesktop(page);
    await openHub(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'motionai-hub-live.png'), animations: 'disabled' });
    console.log('✓ motionai-hub-live.png');
    await page.close();
  }

  // Desktop editor
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await waitForApp(page);
    await dismissOverlays(page);
    await ensureDesktop(page);
    const editable = page.locator('.ProseMirror, [contenteditable="true"]').first();
    if (await editable.isVisible().catch(() => false)) {
      await editable.click();
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'motionai-editor-live.png'), animations: 'disabled' });
    console.log('✓ motionai-editor-live.png');
    await page.close();
  }

  // Settings modal
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await waitForApp(page);
    await dismissOverlays(page);
    await ensureDesktop(page);
    await openSettings(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'motionai-settings-live.png'), animations: 'disabled' });
    console.log('✓ motionai-settings-live.png');
    await page.close();
  }

  // Mobile shell
  {
    const ctx = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await ctx.newPage();
    await waitForApp(page);
    await dismissOverlays(page);
    await page.getByRole('button', { name: 'Ask AI' }).first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'motionai-mobile-live.png'), animations: 'disabled' });
    console.log('✓ motionai-mobile-live.png');
    await ctx.close();
  }

  // Wide hero composite (hub + vignette crop feel)
  {
    const page = await (await browser.newContext({ viewport: { width: 1600, height: 720 } })).newPage();
    await waitForApp(page);
    await dismissOverlays(page);
    await openHub(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'motionai-hero-banner.png'), animations: 'disabled' });
    console.log('✓ motionai-hero-banner.png');
    await page.close();
  }

  await browser.close();
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
