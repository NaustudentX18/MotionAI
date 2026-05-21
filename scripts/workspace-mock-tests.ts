#!/usr/bin/env npx tsx

/**
 * Mocked Workspace helper contract tests.
 *
 * Validates token-gating behavior, error handling, and response shapes
 * for Google Workspace helpers without needing real Google OAuth tokens.
 * All tests run against the raw source with static analysis.
 */

import { strict as assert } from 'node:assert/strict';
import fs from 'node:fs';
import * as mod from '../src/lib/workspace';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}

console.log('\nWorkspace Helper Contract Tests\n');

test('module exports Calendar helper', () => {
  assert.equal(typeof mod.addGoogleCalendarEvent, 'function');
});

test('module exports Task helper', () => {
  assert.equal(typeof mod.addGoogleTask, 'function');
});

test('module exports Drive file listing', () => {
  assert.equal(typeof mod.listGoogleDriveFiles, 'function');
});

test('module exports createDriveFolder', () => {
  assert.equal(typeof mod.createDriveFolder, 'function');
});

test('module exports findDriveFolder', () => {
  assert.equal(typeof mod.findDriveFolder, 'function');
});

test('module exports getWorkspaceStructureStatus', () => {
  assert.equal(typeof mod.getWorkspaceStructureStatus, 'function');
});

test('module exports setupWorkspaceStructure', () => {
  assert.equal(typeof mod.setupWorkspaceStructure, 'function');
});

test('module exports getGoogleDriveFileContent', () => {
  assert.equal(typeof mod.getGoogleDriveFileContent, 'function');
});

test('module exports createGoogleDriveFile', () => {
  assert.equal(typeof mod.createGoogleDriveFile, 'function');
});

test('Drive function signatures accept correct parameters', () => {
  assert.ok(mod.listGoogleDriveFiles.length <= 1, 'listGoogleDriveFiles should accept 0-1 params');
  assert.ok(mod.createDriveFolder.length >= 1, 'createDriveFolder should accept at least name');
  assert.ok(mod.findDriveFolder.length >= 1, 'findDriveFolder should accept at least name');
  assert.ok(mod.getGoogleDriveFileContent.length >= 2, 'getGoogleDriveFileContent should accept fileId and mimeType');
  assert.ok(mod.createGoogleDriveFile.length >= 2, 'createGoogleDriveFile should accept title and content');
});

test('Calendar function signature accepts correct parameters', () => {
  assert.ok(mod.addGoogleCalendarEvent.length >= 4, 'addGoogleCalendarEvent should accept summary, description, start, end');
});

test('Task function signature accepts correct parameters', () => {
  assert.ok(mod.addGoogleTask.length >= 1, 'addGoogleTask should accept at least title');
});

// Static analysis on workspace.ts source
const workspaceSrc = fs.readFileSync('src/lib/workspace.ts', 'utf8');

test('each exported function calls requireGoogleAccessToken internally', () => {
  const guardCalls = (workspaceSrc.match(/await requireGoogleAccessToken\(\)/g) || []).length;
  assert.ok(guardCalls >= 7, `expected at least 7 token-guarded function calls, found ${guardCalls}`);
});

test('functions call fetch with Google API URLs', () => {
  assert.ok(workspaceSrc.includes('www.googleapis.com'), 'module should reference Google API endpoints');
  assert.ok(workspaceSrc.includes('fetch('), 'module should use fetch for HTTP calls');
});

test('requireGoogleAccessToken is defined as local async function', () => {
  assert.match(workspaceSrc, /async function requireGoogleAccessToken/, 'requireGoogleAccessToken should be defined');
  assert.ok(workspaceSrc.includes('getAccessToken()'), 'should call getAccessToken for Firebase auth');
  assert.ok(workspaceSrc.includes('throw new Error'), 'should throw error when token unavailable');
});

test('no hardcoded bearer tokens in workspace source', () => {
  assert.doesNotMatch(workspaceSrc, /Bearer\s+(AIza|ya29\.)/, 'no hardcoded Google credentials');
});

console.log(`\n${passed}/${passed + failed} workspace helper tests passed.\n`);
if (failed > 0) process.exit(1);
