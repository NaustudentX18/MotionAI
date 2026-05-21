/**
 * TipTap Mark extensions for inline text styles.
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';

// ─── Bold Mark ─────────────────────────────────────────────────────────────────

export const boldMark = Mark.create({
  name: 'bold',
  addAttributes() {
    return {};
  },
  parseHTML() {
    return [{ tag: 'strong' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['strong', mergeAttributes(HTMLAttributes), 0];
  },
});

// ─── Italic Mark ──────────────────────────────────────────────────────────────

export const italicMark = Mark.create({
  name: 'italic',
  addAttributes() {
    return {};
  },
  parseHTML() {
    return [{ tag: 'em' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['em', mergeAttributes(HTMLAttributes), 0];
  },
});

// ─── Underline Mark ────────────────────────────────────────────────────────────

// Note: Uses @tiptap/extension-underline which itself depends on TextStyle
export const underlineMark = Underline;

// ─── Color Mark ───────────────────────────────────────────────────────────────

export const colorMark = Mark.create({
  name: 'color',
  addAttributes() {
    return {
      color: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-color]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-color': HTMLAttributes.color }),
      0,
    ];
  },
});

// ─── Highlight Mark ───────────────────────────────────────────────────────────

export const highlightMark = Highlight;

// ─── Export all marks as an array ─────────────────────────────────────────────

export const inlineMarks = [boldMark, italicMark, underlineMark, colorMark, highlightMark];
