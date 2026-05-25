export const BLOCK_TYPES = [
  'p',
  'h1',
  'h2',
  'h3',
  'todo',
  'bullet',
  'divider',
  'callout',
  'quote',
  'ai-summary',
  'ai-draft',
  'ai-rewrite',
  'code',
  'image',
  'database',
] as const;

export type BlockType = typeof BLOCK_TYPES[number];

export interface BlockComment {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

export interface BlockStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string; // e.g. '#37352F', '#E03E3E', etc
  backgroundColor?: string; // e.g. 'transparent', '#F1F1F0', etc
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean; // for todo
  indentLevel?: number; // hierarchical indentation (0 to 4)
  style?: BlockStyle;
  comments?: BlockComment[];
  aiPrompt?: string;
  aiContext?: string;
  language?: string; // support syntax highlighted code blocks
}

export interface PageVersion {
  id: string;
  timestamp: number;
  title: string;
  blocks: Block[];
}

export const PAGE_TYPES = ['block', 'canvas', 'database', 'dashboard', 'space', 'folder'] as const;

export type PageType = typeof PAGE_TYPES[number];

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
  versions?: PageVersion[];
  pageType?: PageType;
  parentId?: string | null; // for nested spaces/folders/docs structure
  priority?: 'Urgent' | 'High' | 'Normal' | 'Low';
  dueDate?: string;
  assignee?: string;
  estimatedTime?: number; // estimated time in minutes
  actualTime?: number; // tracked time in minutes
  isTimerRunning?: boolean;
  timerStartTime?: number;
  reminderDate?: string; // ISO date string (YYYY-MM-DD) or datetime
}

