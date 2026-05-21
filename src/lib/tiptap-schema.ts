/**
 * TipTap Node extensions for all 13 MotionAI block types.
 * Each node is rendered as a <div data-type="nodeName" data-id="..."> for consistent parsing/rendering.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';

// Create lowlight instance with common languages for syntax highlighting
const lowlight = createLowlight(common);

// ─── Base block attributes shared by all nodes ──────────────────────────────────

const baseBlockAttrs = () => ({
  id: { default: null },
  indentLevel: { default: 0 },
  comments: { default: '[]' },
});

// Helper: wraps block renderHTML output with a drag handle span as first child.
// The span is position:absolute and rendered to the left of the block content.
function renderBlock(
  dataType: string,
  HTMLAttributes: Record<string, unknown>
): [string, Record<string, unknown>, [string, Record<string, unknown>, string], 0] {
  const comments = HTMLAttributes['comments'] as string ?? '[]';
  return [
    'div',
    mergeAttributes(HTMLAttributes, { 'data-type': dataType, 'data-comments': comments }),
    ['span', { class: 'drag-handle', draggable: 'true', contenteditable: 'false' }, '⠿'],
    0,
  ];
}

// ─── Paragraph Node ───────────────────────────────────────────────────────────

export const pNode = Node.create({
  name: 'pNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="pNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('pNode', HTMLAttributes);
  },
});

// ─── Heading Nodes ─────────────────────────────────────────────────────────────

export const h1Node = Node.create({
  name: 'h1Node',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="h1Node"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('h1Node', HTMLAttributes);
  },
});

export const h2Node = Node.create({
  name: 'h2Node',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="h2Node"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('h2Node', HTMLAttributes);
  },
});

export const h3Node = Node.create({
  name: 'h3Node',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="h3Node"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('h3Node', HTMLAttributes);
  },
});

// ─── Todo Node ─────────────────────────────────────────────────────────────────

export const todoNode = Node.create({
  name: 'todoNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
      checked: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="todoNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('todoNode', HTMLAttributes);
  },
});

// ─── Bullet Node ───────────────────────────────────────────────────────────────

export const bulletNode = Node.create({
  name: 'bulletNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="bulletNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('bulletNode', HTMLAttributes);
  },
});

// ─── Divider Node (atomic/leaf — renders as <hr>) ────────────────────────────

export const dividerNode = Node.create({
  name: 'dividerNode',
  group: 'block',
  atom: true, // leaf node — cannot have content
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'hr[data-type="dividerNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { 'data-type': 'dividerNode' })];
  },
});

// ─── Callout Node ──────────────────────────────────────────────────────────────

export const calloutNode = Node.create({
  name: 'calloutNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="calloutNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('calloutNode', HTMLAttributes);
  },
});

// ─── Quote Node ───────────────────────────────────────────────────────────────

export const quoteNode = Node.create({
  name: 'quoteNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="quoteNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('quoteNode', HTMLAttributes);
  },
});

// ─── AI Summary Node ──────────────────────────────────────────────────────────

export const aiSummaryNode = Node.create({
  name: 'aiSummaryNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
      aiPrompt: { default: '' },
      aiContext: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="aiSummaryNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('aiSummaryNode', HTMLAttributes);
  },
});

// ─── AI Draft Node ─────────────────────────────────────────────────────────────

export const aiDraftNode = Node.create({
  name: 'aiDraftNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
      aiPrompt: { default: '' },
      aiContext: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="aiDraftNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('aiDraftNode', HTMLAttributes);
  },
});

// ─── AI Rewrite Node ───────────────────────────────────────────────────────────

export const aiRewriteNode = Node.create({
  name: 'aiRewriteNode',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      ...baseBlockAttrs(),
      aiPrompt: { default: '' },
      aiContext: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="aiRewriteNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return renderBlock('aiRewriteNode', HTMLAttributes);
  },
});

// ─── Image Node ────────────────────────────────────────────────────────────────

export const imageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes), 0];
  },
});

// ─── Code Node (with syntax highlighting via lowlight) ─────────────────────────

// Extend CodeBlockLowlight to integrate with the block system's HTML structure
export const codeNode = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...baseBlockAttrs(),
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    // Get the standard CodeBlockLowlight rendered content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [, codeAttrs, children] = (this.parent?.({ node, HTMLAttributes }) ?? [
      'pre',
      {},
      ['code', {}, 0],
    ]) as any;

    // Wrap with block structure: div[data-type="codeNode"] with drag handle
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'codeNode' }),
      ['span', { class: 'drag-handle', draggable: 'true', contenteditable: 'false' }, '⠿'],
      ['code', codeAttrs, children],
    ];
  },
  parseHTML() {
    return [{ tag: 'div[data-type="codeNode"]' }];
  },
}).configure({
  lowlight,
  defaultLanguage: 'javascript',
});

// ─── Export all nodes as a schema array ───────────────────────────────────────

export const blockSchema = [
  pNode,
  h1Node,
  h2Node,
  h3Node,
  todoNode,
  bulletNode,
  dividerNode,
  calloutNode,
  quoteNode,
  aiSummaryNode,
  aiDraftNode,
  aiRewriteNode,
  codeNode,
  imageNode,
];
