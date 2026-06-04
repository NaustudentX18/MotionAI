export interface ShortcutDef {
  keys: string;
  description: string;
  category: 'Navigation' | 'Editor' | 'AI' | 'Workspace';
}

export const MOTIONAI_SHORTCUTS: ShortcutDef[] = [
  { keys: '⌘/Ctrl K', description: 'Command palette — search pages & AI', category: 'Navigation' },
  { keys: '⌘/Ctrl Shift J', description: "Open today's journal", category: 'Workspace' },
  { keys: '⌘/Ctrl Shift C', description: 'Quick capture to daily note', category: 'Workspace' },
  { keys: '⌘/Ctrl ,', description: 'Settings', category: 'Workspace' },
  { keys: '?', description: 'Keyboard shortcuts (this panel)', category: 'Navigation' },
  { keys: 'Esc', description: 'Close palette / modals', category: 'Navigation' },
  { keys: '↑ ↓ Enter', description: 'Navigate command palette results', category: 'Navigation' },
  { keys: '/', description: 'Slash commands in editor blocks', category: 'Editor' },
  { keys: '[[Title]]', description: 'Wiki-link to another page', category: 'Editor' },
];
