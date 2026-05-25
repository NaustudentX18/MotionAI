import type { Page } from '../../types';
import type { WorkspaceSnapshot } from '../persistence';

export interface ImportResult {
  snapshot: WorkspaceSnapshot;
  warnings: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(val => val.replace(/^"|"$/g, ''));
}

export function csvExportToWorkspace(csvContent: string): ImportResult {
  const warnings: string[] = [];
  const pages: Page[] = [];
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      snapshot: { pages: [], currentPageId: null },
      warnings: ['CSV file is empty or missing data rows.']
    };
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  
  // Find column indexes
  const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('name') || h === 'subject');
  const dueDateIdx = headers.findIndex(h => h.includes('due') || h.includes('deadline') || h.includes('date'));
  const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('stage'));
  const priorityIdx = headers.findIndex(h => h.includes('priority'));
  const assigneeIdx = headers.findIndex(h => h.includes('assignee') || h.includes('owner') || h.includes('user'));
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('notes') || h.includes('content') || h.includes('body'));

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < headers.length) continue;

    const title = titleIdx !== -1 ? row[titleIdx] : `Row ${i}`;
    const description = descIdx !== -1 ? row[descIdx] : '';
    const status = statusIdx !== -1 ? row[statusIdx] : 'todo';
    const priority = priorityIdx !== -1 ? row[priorityIdx] : 'normal';
    const assignee = assigneeIdx !== -1 ? row[assigneeIdx] : '';
    const dueDateVal = dueDateIdx !== -1 ? row[dueDateIdx] : '';

    const pageId = `csv-row-${crypto.randomUUID()}`;

    const blocks = [
      { id: crypto.randomUUID(), type: 'p' as const, content: description || 'Imported from CSV' },
      { id: crypto.randomUUID(), type: 'callout' as const, content: `Import metadata - Status: ${status} | Priority: ${priority} | Assignee: ${assignee || 'Unassigned'}` }
    ];

    const page: Page = {
      id: pageId,
      title: title || `Untitled Row ${i}`,
      icon: '📊',
      cover: null,
      blocks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageType: 'block'
    };

    if (dueDateVal) {
      const d = new Date(dueDateVal);
      if (!isNaN(d.getTime())) {
        page.dueDate = d.toISOString().split('T')[0];
      }
    }
    
    if (assignee) page.assignee = assignee;
    (page as any).status = status;
    (page as any).priority = priority;

    pages.push(page);
  }

  warnings.push(`Successfully imported ${pages.length} rows as workspace database/task pages.`);

  return {
    snapshot: {
      pages,
      currentPageId: pages[0]?.id ?? null
    },
    warnings
  };
}
