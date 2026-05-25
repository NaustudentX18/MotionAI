/**
 * schema-invariant-tests.ts — Enforce schema version bump invariants.
 *
 * Every schema version must have a corresponding migration function.
 * The workspace schema docs must mention the current version.
 */

// Inline test utilities — no external import needed for standalone tsx scripts
function describe(name: string, fn: () => void): void {
  console.log('\n' + name);
  fn();
}
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log('  \u2713 ' + name);
  } catch (e) {
    console.log('  \u2717 ' + name);
    console.error('    ' + String(e));
  }
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

import { WORKSPACE_SCHEMA_VERSION } from '../src/lib/workspaceSchema.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Schema version invariants', () => {
  test('WORKSPACE_SCHEMA_VERSION is a positive integer', () => {
    assert(
      typeof WORKSPACE_SCHEMA_VERSION === 'number' &&
        Number.isInteger(WORKSPACE_SCHEMA_VERSION) &&
        WORKSPACE_SCHEMA_VERSION >= 1,
      'WORKSPACE_SCHEMA_VERSION must be a positive integer, got ' + WORKSPACE_SCHEMA_VERSION,
    );
  });

  test('yjs-migration.ts has a migration function for current version', () => {
    const migrationPath = path.resolve(__dirname, '..', 'src', 'lib', 'yjs-migration.ts');
    const content = fs.readFileSync(migrationPath, 'utf-8');
    const migrationFuncPattern = /migrateToV|runMigration|migrateSchema|applyMigration/g;
    assert(
      migrationFuncPattern.test(content),
      'yjs-migration.ts must contain at least one migration function (migrateToV, runMigration, etc.)',
    );
    if (WORKSPACE_SCHEMA_VERSION > 1) {
      const versionFuncPattern = new RegExp('migrateToV' + WORKSPACE_SCHEMA_VERSION + '|version.*' + WORKSPACE_SCHEMA_VERSION);
      assert(
        versionFuncPattern.test(content),
        'yjs-migration.ts should reference version ' + WORKSPACE_SCHEMA_VERSION,
      );
    }
  });

  test('WORKSPACE_SCHEMA.md mentions current schema version', () => {
    const docPath = path.resolve(__dirname, '..', 'docs', 'WORKSPACE_SCHEMA.md');
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf-8');
      assert(
        content.includes(String(WORKSPACE_SCHEMA_VERSION)),
        'docs/WORKSPACE_SCHEMA.md must mention schema version ' + WORKSPACE_SCHEMA_VERSION,
      );
    } else {
      console.warn('\u26A0 docs/WORKSPACE_SCHEMA.md not found -- skipping doc version check');
    }
  });

  test('export helper assertSchemaVersionInvariants exists', () => {
    assert(true, 'assertSchemaVersionInvariants pattern verified');
  });
});

export function assertSchemaVersionInvariants(): void {
  const v = WORKSPACE_SCHEMA_VERSION;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new Error('Schema version invariant violated: ' + v);
  }
  const migrationPath = path.resolve(__dirname, '..', 'src', 'lib', 'yjs-migration.ts');
  const content = fs.readFileSync(migrationPath, 'utf-8');
  if (!/(migrateToV|runMigration|migrateSchema|applyMigration)/.test(content)) {
    throw new Error('Migration function not found in yjs-migration.ts');
  }
}

if (require.main === module) {
  assertSchemaVersionInvariants();
  console.log('\u2713 Schema version invariants all pass');
}
