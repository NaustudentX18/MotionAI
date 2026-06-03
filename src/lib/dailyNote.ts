import { v4 as uuidv4 } from 'uuid';
import type { Block, Page } from '../types';

export function dailyJournalTitle(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `Journal ${yyyy}-${mm}-${dd}`;
}

export function findDailyPage(pages: Page[], date: Date = new Date()): Page | undefined {
  const title = dailyJournalTitle(date);
  return pages.find(
    page =>
      page.title === title &&
      (page.pageType === 'block' || page.pageType === undefined),
  );
}

export function createDailyPage(date: Date = new Date(), initialBlock?: Block): Page {
  return {
    id: uuidv4(),
    title: dailyJournalTitle(date),
    icon: '📓',
    cover: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pageType: 'block',
    blocks: initialBlock
      ? [initialBlock]
      : [{ id: uuidv4(), type: 'p', content: '' }],
  };
}

export function getOrCreateDailyPage(
  pages: Page[],
  onAddPage: (page: Page) => void,
  date: Date = new Date(),
): Page {
  const existing = findDailyPage(pages, date);
  if (existing) return existing;

  const newPage = createDailyPage(date);
  onAddPage(newPage);
  return newPage;
}

export function appendBlockToDailyPage(
  pages: Page[],
  onAddPage: (page: Page) => void,
  onUpdatePage: (pageId: string, blocks: Block[]) => void,
  content: string,
  date: Date = new Date(),
): { pageId: string; blockId: string } {
  const block: Block = { id: uuidv4(), type: 'p', content };
  const existing = findDailyPage(pages, date);

  if (existing) {
    onUpdatePage(existing.id, [...existing.blocks, block]);
    return { pageId: existing.id, blockId: block.id };
  }

  const newPage = createDailyPage(date, block);
  onAddPage(newPage);
  return { pageId: newPage.id, blockId: block.id };
}
