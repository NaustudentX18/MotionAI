/**
 * TipTap InputRule instances for markdown shortcuts.
 * Each rule fires when the user types the trigger pattern at the start of a line.
 */

import { InputRule } from '@tiptap/core';

function lineStartRule(
  find: RegExp,
  nodeType: string,
  attrs?: Record<string, unknown>
): InputRule {
  return new InputRule({
    find,
    handler: ({ state, range, commands }) => {
      // Only fire at line start
      if (state.selection.$from.parentOffset !== 0) return;
      commands.deleteRange(range);
      commands.setNode(nodeType, attrs);
    },
  });
}

export function createInputRules(): InputRule[] {
  return [
    // Heading 1: # + space
    lineStartRule(/^# $/, 'h1Node'),

    // Heading 2: ## + space
    lineStartRule(/^## $/, 'h2Node'),

    // Heading 3: ### + space
    lineStartRule(/^### $/, 'h3Node'),

    // Bullet list: - + space or * + space
    lineStartRule(/^[-*] $/, 'bulletNode'),

    // Ordered list: 1. + space
    lineStartRule(/^1\. $/, 'bulletNode'),

    // Blockquote: > + space
    lineStartRule(/^> $/, 'quoteNode'),

    // Todo unchecked: [] + space or [ ] + space
    lineStartRule(/^\[\s?\] $/, 'todoNode', { checked: false }),

    // Todo checked: [x] + space or [X] + space
    lineStartRule(/^\[[xX]\] $/, 'todoNode', { checked: true }),

    // Divider: --- on its own line
    new InputRule({
      find: /^---$/,
      handler: ({ state, range, commands }) => {
        // Only fire at line start
        if (state.selection.$from.parentOffset !== 0) return;
        commands.deleteRange(range);
        commands.setNode('dividerNode');
      },
    }),

    // Code block: ``` + space (triple backticks)
    lineStartRule(/^``` $/, 'codeNode'),
  ];
}
