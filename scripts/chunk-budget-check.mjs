/**
 * chunk-budget-check.mjs — Fails if any production chunk exceeds budget.
 * Run after `npm run build` in CI.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist', 'client', 'assets');
const BUDGET_BYTES = 500 * 1024; // 500 kB gzipped

if (!fs.existsSync(DIST_DIR)) {
  // Server-only builds may not have client assets
  console.log('No client assets directory found — skipping chunk budget check');
  process.exit(0);
}

let failures = 0;
const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js') || f.endsWith('.css'));

for (const file of files) {
  const filePath = path.join(DIST_DIR, file);
  const stat = fs.statSync(filePath);
  const sizeKB = (stat.size / 1024).toFixed(1);

  if (stat.size > BUDGET_BYTES) {
    console.error(`FAIL: ${file} is ${sizeKB} kB (budget: ${BUDGET_BYTES / 1024} kB)`);
    failures++;
  } else {
    console.log(`OK: ${file} ${sizeKB} kB`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} chunk(s) exceed budget. Reduce size or increase BUDGET_BYTES.`);
  process.exit(1);
}

console.log(`\nAll ${files.length} chunks within budget (${BUDGET_BYTES / 1024} kB max).`);
