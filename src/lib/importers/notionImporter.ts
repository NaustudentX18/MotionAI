import type { Page, Block } from '../../types';
import type { WorkspaceSnapshot } from '../persistence';

export interface NotionMarkdownPage {
  title: string;
  blocks: string[];
}

export interface ImportResult {
  snapshot: WorkspaceSnapshot;
  warnings: string[];
}

export function parseNotionMarkdownBlocks(markdown: string, _pageTitle: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    i++;

    if (!trimmed) continue;

    // Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        id: crypto.randomUUID(),
        type: `h${level}` as Block['type'],
        content: headingMatch[2],
      });
      continue;
    }

    // Checklist
    const checklistMatch = trimmed.match(/^- \[([ x])\]\s+(.+)/);
    if (checklistMatch) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'todo' as Block['type'],
        content: checklistMatch[2],
        checked: checklistMatch[1] === 'x',
      });
      continue;
    }

    // Bullet
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)/);
    if (bulletMatch) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'bullet' as Block['type'],
        content: bulletMatch[1],
      });
      continue;
    }

    // Numbered list (render as plain paragraph)
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'p' as Block['type'],
        content: numberedMatch[1],
      });
      continue;
    }

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s+(.+)/);
    if (quoteMatch) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'quote' as Block['type'],
        content: quoteMatch[1],
      });
      continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        id: crypto.randomUUID(),
        type: 'code' as Block['type'],
        content: codeLines.join('\n'),
        language: trimmed.slice(3).trim() || undefined,
      });
      continue;
    }

    // Divider
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'divider' as Block['type'],
        content: '',
      });
      continue;
    }

    // Default paragraph
    blocks.push({
      id: crypto.randomUUID(),
      type: 'p' as Block['type'],
      content: trimmed,
    });
  }

  return blocks;
}

export function notionMarkdownToPage(markdown: string, title: string, pageId?: string): Page {
  return {
    id: pageId ?? crypto.randomUUID(),
    title,
    icon: '📥',
    cover: null,
    blocks: parseNotionMarkdownBlocks(markdown, title),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function notionExportToWorkspace(
  pages: NotionMarkdownPage[],
  options?: { prefixPageIds?: boolean },
): ImportResult {
  const warnings: string[] = [];
  const importedPages: Page[] = [];

  for (const p of pages) {
    const pageId = options?.prefixPageIds ? `notion-${crypto.randomUUID()}` : crypto.randomUUID();
    importedPages.push(notionMarkdownToPage(p.blocks.join('\n'), p.title, pageId));
  }

  warnings.push(`Imported ${pages.length} pages from Notion markdown format.`);

  return {
    snapshot: {
      pages: importedPages,
      currentPageId: importedPages[0]?.id ?? null,
    },
    warnings,
  };
}
