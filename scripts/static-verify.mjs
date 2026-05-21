#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}

check('package exposes credential-free local verification scripts and contract tests', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts['verify:static'], 'node scripts/static-verify.mjs');
  assert.ok(pkg.scripts.verify?.includes('verify:static'));
  assert.ok(pkg.scripts.verify?.includes('test:ai'), 'verify script should include test:ai');
  assert.ok(pkg.scripts.test?.includes('verify:static'));
  assert.ok(pkg.scripts['test:ai']?.startsWith('npx tsx '), 'test:ai script should use npx tsx');
  assert.ok(pkg.scripts['test:spellcheck']?.startsWith('npx tsx '), 'test:spellcheck script should use npx tsx');
  assert.ok(pkg.scripts['test:workspace']?.startsWith('npx tsx '), 'test:workspace script should use npx tsx');
  assert.ok(pkg.scripts['test:import-export']?.startsWith('npx tsx '), 'test:import-export script should use npx tsx');
});

check('required documentation artifacts exist', () => {
  for (const file of ['ROADMAP.md', 'KNOWN_LIMITATIONS.md']) {
    assert.ok(exists(file), `${file} is missing`);
    const body = read(file);
    assert.ok(body.includes('Credential-free local verification'), `${file} must document local verification`);
    assert.ok(body.length > 500, `${file} should contain useful audit detail`);
  }
});

check('example environment does not contain real-looking secrets', () => {
  const envExample = read('.env.example');
  assert.match(envExample, /GEMINI_API_KEY="MY_GEMINI_API_KEY"/);
  assert.doesNotMatch(envExample, /AIza[0-9A-Za-z_-]{20,}/, 'real-looking Google API key found in .env.example');
  assert.doesNotMatch(envExample, /ya29\.[0-9A-Za-z_-]+/, 'real-looking Google OAuth token found in .env.example');
});

check('server AI endpoints keep a provider-agnostic not-configured guard', () => {
  const server = read('server.ts');
  assert.match(server, /import\s*\{[\s\S]*?\bcreateAiClient\b[\s\S]*?\}\s+from\s+['"]\.\/src\/lib\/ai\/providers['"]/,
    'server.ts must import createAiClient from the multi-provider AI module');
  assert.match(server, /import\s*\{[\s\S]*?\bextractAiSettings\b[\s\S]*?\}\s+from\s+['"]\.\/src\/lib\/ai\/providers['"]/,
    'server.ts must import extractAiSettings from the multi-provider AI module');
  const aiEndpointCount = [...server.matchAll(/app\.post\('\/api\/ai\//g)].length;
  const guardCount = [...server.matchAll(/if\s*\(!client\.info\.enabled\s*\|\|\s*!client\.info\.configured\)/g)].length;
  assert.ok(aiEndpointCount >= 3, `expected at least 3 AI endpoints, found ${aiEndpointCount}`);
  assert.ok(guardCount >= 3, `expected at least 3 client.info guard checks, found ${guardCount}`);
  const firstGuardIndex = server.search(/if\s*\(!client\.info\.enabled/);
  const firstGenerateIndex = server.search(/\.generateText\(/);
  assert.ok(firstGuardIndex >= 0 && firstGenerateIndex >= 0, 'server.ts must have client.info guard and generateText calls');
  assert.ok(firstGuardIndex < firstGenerateIndex, 'first client.info not-configured guard must precede first generateText call');
});

check('AI endpoints are protected by rate-limit middleware', () => {
  const server = read('server.ts');
  assert.match(server, /import\s*\{[\s\S]*?\brateLimitMiddleware\b[\s\S]*?\}\s+from\s+['"]\.\/src\/lib\/rateLimit['"]/,
    'server.ts must import rateLimitMiddleware');
  assert.match(server, /import\s*\{[\s\S]*?\brateLimitMiddleware\b[\s\S]*?\}.*['"]\.\/src\/lib\/rateLimit['"]/,
    'server.ts must import rateLimitMiddleware from src/lib/rateLimit');
  // Every AI POST route should have rateLimitMiddleware as the second argument
  const aiPostRoutes = [...server.matchAll(/app\.post\('\/api\/ai\/[^']+',/g)].length;
  const rateLimitArgs = [...server.matchAll(/app\.post\('\/api\/ai\/[^']+', rateLimitMiddleware,/g)].length;
  assert.ok(rateLimitArgs >= 3, `expected at least 3 AI POST routes with rateLimitMiddleware, found ${rateLimitArgs} of ${aiPostRoutes} total`);
});

check('rate-limit module is self-contained with env-var configuration', () => {
  const rateLimit = read('src/lib/rateLimit.ts');
  assert.match(rateLimit, /export function checkRateLimit\(/, 'rateLimit must export checkRateLimit');
  assert.match(rateLimit, /AI_RATE_LIMIT_WINDOW_MS/, 'rateLimit must support AI_RATE_LIMIT_WINDOW_MS env var');
  assert.match(rateLimit, /AI_RATE_LIMIT_MAX_REQS/, 'rateLimit must support AI_RATE_LIMIT_MAX_REQS env var');
});

check('Google Workspace helpers require auth before external API calls', () => {
  const workspace = read('src/lib/workspace.ts');
  const exportedFunctions = [...workspace.matchAll(/export async function /g)].length;
  const directTokenGuards = [...workspace.matchAll(/await requireGoogleAccessToken\(\)/g)].length;
  assert.ok(exportedFunctions >= 7, `expected several Workspace helpers, found ${exportedFunctions}`);
  assert.match(workspace, /async function requireGoogleAccessToken\(\)[\s\S]*getAccessToken\(\)[\s\S]*throw new Error/, 'Workspace helpers should centralize missing-token failure');
  assert.ok(directTokenGuards >= 7, `expected direct Google API helpers to call requireGoogleAccessToken, found ${directTokenGuards}`);
  assert.match(workspace, /export async function setupWorkspaceStructure[\s\S]*findDriveFolder[\s\S]*createDriveFolder/, 'composite workspace setup should reuse guarded Drive helpers');
  assert.doesNotMatch(workspace, /Bearer\s+(AIza|ya29\.)/, 'workspace code must not hardcode Google credentials');
});

check('source has no accidental credential literals outside placeholders', () => {
  const files = [
    'server.ts',
    'firebase-applet-config.json',
    'src/lib/firebase.ts',
    'src/lib/workspace.ts',
    'src/App.tsx',
  ];
  const combined = files.map((file) => `\n--- ${file} ---\n${read(file)}`).join('\n');
  assert.doesNotMatch(combined, /ya29\.[0-9A-Za-z_-]+/, 'Google OAuth token literal found');
  assert.doesNotMatch(combined, /sk-[A-Za-z0-9_-]{20,}/, 'OpenAI-style secret literal found');
});

check('README roadmap claims include evidence-based status labels', () => {
  const readme = read('README.md');
  const sections = [...readme.matchAll(/### \d+\. 🚀 Offline/g)];
  // Actually check for status labels on roadmap sections
  const labeledSections = [...readme.matchAll(/### \d+\. .+ \uD83D\uDD34 Planned|### \d+\. .+ \uD83D\uDFE2 Partial/g)];
  // Check for current status annotations
  const statusAnnotations = [...readme.matchAll(/> 🟡|> 🔴/g)];
  assert.ok(labeledSections.length >= 3, `expected at least 3 roadmap sections with status labels, found ${labeledSections.length}`);
  assert.ok(statusAnnotations.length >= 6, `expected at least 6 implementation status annotations, found ${statusAnnotations.length}`);
});

for (const result of checks) {
  if (result.ok) {
    console.log(`✓ ${result.name}`);
  } else {
    console.error(`✗ ${result.name}`);
    console.error(result.error?.stack || result.error);
  }
}

const failed = checks.filter((result) => !result.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} static verification checks passed.`);
if (failed.length > 0) {
  process.exitCode = 1;
}
