#!/usr/bin/env node
/**
 * Pre-push secret scan — fails if likely API keys or tokens appear in tracked files.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const TRACKED = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(
    f =>
      !f.startsWith('node_modules/') &&
      !f.endsWith('.lock') &&
      !f.includes('package-lock.json') &&
      f !== '.env' &&
      f !== 'firebase-applet-config.json' &&
      f !== 'scripts/secret-redaction-tests.ts',
  );

const PATTERNS = [
  { name: 'OpenAI key', re: /sk-proj-[A-Za-z0-9]{20,}/ },
  { name: 'Google API key', re: /AIza[0-9A-Za-z\-_]{30,}/ },
  { name: 'GitHub PAT', re: /ghp_[A-Za-z0-9]{30,}/ },
  { name: 'Anthropic key', re: /sk-ant-[A-Za-z0-9\-_]{20,}/ },
];

const ALLOWLIST_SUBSTRINGS = [
  'MY_GEMINI_API_KEY',
  'MY_OPENAI_API_KEY',
  'MY_MOTIONAI_API_SECRET',
  'MY_GITHUB_TOKEN',
  'firebase-applet-config',
];

let failed = false;

for (const file of TRACKED) {
  if (!existsSync(file)) continue;
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const { name, re } of PATTERNS) {
    const match = content.match(re);
    if (!match) continue;
    const snippet = match[0];
    if (ALLOWLIST_SUBSTRINGS.some(a => content.includes(a) && snippet.length < 60)) continue;
    if (file.includes('.env.example')) continue;
    console.error(`FAIL [${name}] in ${file}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nSecret audit failed. Remove credentials before pushing.');
  process.exit(1);
}

console.log(`Secret audit passed (${TRACKED.length} files scanned).`);
