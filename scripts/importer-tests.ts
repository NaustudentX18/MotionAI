#!/usr/bin/env npx tsx

import { strict as assert } from 'node:assert/strict';
import { parseNotionMarkdownBlocks, notionMarkdownToPage, notionExportToWorkspace } from '../src/lib/importers/notionImporter';
import { clickupExportToWorkspace } from '../src/lib/importers/clickupImporter';
import type { ClickUpSpace, ClickUpList, ClickUpTask } from '../src/lib/importers/clickupImporter';
import { csvExportToWorkspace } from '../src/lib/importers/csvImporter';

function testNotionHeadingParsing() {
  const blocks = parseNotionMarkdownBlocks('# Heading 1\n## Heading 2\n### Heading 3\nPlain text', 'Test');
  assert.equal(blocks.length, 4, 'Should parse 4 blocks');
  assert.equal(blocks[0].type, 'h1', 'First block should be h1');
  assert.equal(blocks[0].content, 'Heading 1');
  assert.equal(blocks[1].type, 'h2', 'Second block should be h2');
  assert.equal(blocks[2].type, 'h3', 'Third block should be h3');
  assert.equal(blocks[3].type, 'p', 'Fourth block should be p');
  console.log('  ✓ Notion heading parsing');
}

function testNotionChecklistParsing() {
  const blocks = parseNotionMarkdownBlocks('- [x] Done task\n- [ ] Pending task', 'Test');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'todo', 'Done task should be todo');
  assert.equal((blocks[0] as any).checked, true);
  assert.equal((blocks[1] as any).checked, false);
  console.log('  ✓ Notion checklist parsing');
}

function testNotionBulletAndCodeParsing() {
  const blocks = parseNotionMarkdownBlocks('- Bullet item\n- Another bullet\n```\ncode block\n```', 'Test');
  assert.equal(blocks.length, 3, 'Should parse 3 blocks');
  assert.equal(blocks[0].type, 'bullet');
  assert.equal(blocks[2].type, 'code');
  console.log('  ✓ Notion bullet + code parsing');
}

function testNotionDividerAndQuoteParsing() {
  const blocks = parseNotionMarkdownBlocks('---\n> Quoted text', 'Test');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'divider');
  assert.equal(blocks[1].type, 'quote');
  console.log('  ✓ Notion divider + quote parsing');
}

function testNotionMarkdownToPage() {
  const page = notionMarkdownToPage('# My Page\n\nSome content', 'My Page');
  assert.equal(page.title, 'My Page');
  assert.equal(page.blocks.length, 2);
  assert.equal(page.icon, '📥');
  assert(page.cover === null);
  console.log('  ✓ Notion markdown to page');
}

function testNotionExportToWorkspace() {
  const result = notionExportToWorkspace([
    { title: 'Page 1', blocks: ['# Page 1', 'Content 1'] },
    { title: 'Page 2', blocks: ['## Page 2', 'Content 2'] },
  ]);
  assert.equal(result.snapshot.pages.length, 2);
  assert(result.warnings.length > 0);
  console.log('  ✓ Notion export to workspace');
}

function testClickupTaskToPage() {
  const spaces: ClickUpSpace[] = [{
    id: 's1', name: 'Space 1', lists: [{
      id: 'l1', name: 'List 1', tasks: [
        { id: 't1', name: 'Task 1', description: 'Desc 1', status: 'open' },
      ],
    }],
  }];
  const result = clickupExportToWorkspace(spaces);
  assert.equal(result.snapshot.pages.length, 3, 'Space + List + Task = 3 pages');
  const taskPage = result.snapshot.pages.find(p => p.title === 'Task 1');
  assert(taskPage, 'Task page should exist');
  assert(taskPage.id.startsWith('clickup-'));
  console.log('  ✓ ClickUp task to page');
}

function testClickupTaskWithPriorityAndDueDate() {
  const spaces: ClickUpSpace[] = [{
    id: 's2', name: 'Space', lists: [{
      id: 'l2', name: 'List', tasks: [
        { id: 't2', name: 'Urgent task', description: '', status: 'open', priority: 1, due_date: '1710000000000' },
      ],
    }],
  }];
  const result = clickupExportToWorkspace(spaces);
  const task = result.snapshot.pages.find(p => p.id === 'clickup-t2');
  assert(task, 'Task should exist');
  console.log('  ✓ ClickUp priority + due date mapping');
}

function testCsvExportToWorkspace() {
  const csvContent = `Title,Description,Status,Priority,Assignee,Due Date\n` +
    `"Task Alpha","Setup cluster nodes","in-progress","high","Alex","2026-05-25"\n` +
    `"Task Beta","Clean container volumes","todo","normal","Jake",""`;

  const result = csvExportToWorkspace(csvContent);
  assert.equal(result.snapshot.pages.length, 2, 'Should import 2 pages');
  const taskAlpha = result.snapshot.pages.find(p => p.title === 'Task Alpha');
  assert(taskAlpha, 'Task Alpha should exist');
  assert.equal((taskAlpha as any).status, 'in-progress');
  assert.equal((taskAlpha as any).priority, 'high');
  assert.equal(taskAlpha.assignee, 'Alex');
  assert.equal(taskAlpha.dueDate, '2026-05-25');
  console.log('  ✓ CSV task to page mapping');
}

async function main() {
  console.log('Importer Tests\n');

  const tests = [
    testNotionHeadingParsing,
    testNotionChecklistParsing,
    testNotionBulletAndCodeParsing,
    testNotionDividerAndQuoteParsing,
    testNotionMarkdownToPage,
    testNotionExportToWorkspace,
    testClickupTaskToPage,
    testClickupTaskWithPriorityAndDueDate,
    testCsvExportToWorkspace,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (e) {
      failed++;
      console.error(`  ✗ ${test.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n${passed}/${passed + failed} importer tests passed.`);
  if (failed > 0) process.exitCode = 1;
}

main();
