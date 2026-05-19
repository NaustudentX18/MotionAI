export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'todo' | 'bullet' | 'divider' | 'callout' | 'quote';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean; // for todo
}

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}
