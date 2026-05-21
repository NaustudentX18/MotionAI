/**
 * DragHandleExtension — ProseMirror plugin that enables drag-to-reorder for
 * TipTap block nodes rendered as <div data-type="xxx" data-id="...">.
 *
 * Handles:
 * - dragstart on the grip handle element inside a block
 * - dragover to allow drop on any block
 * - drop to reorder blocks in the document
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';

export const dragHandlePluginKey = new PluginKey('dragHandle');

export const DragHandleExtension = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dragHandlePluginKey,

        props: {
          handleDOMEvents: {
            // Initiate drag when the grip handle is clicked + dragged
            dragstart: (view, event) => {
              const target = event.target as HTMLElement;
              if (!target.matches('.drag-handle')) return false;

              const blockEl = target.closest('[data-type]') as HTMLElement | null;
              if (!blockEl) return false;

              const blockId = blockEl.dataset.id;
              if (!blockId) return false;

              const dt = (event as DragEvent).dataTransfer;
              if (!dt) return false;

              dt.effectAllowed = 'move';
              dt.setData('application/x-block-id', blockId);

              // Drag image — clone the block element so it appears as a ghost
              const clone = blockEl.cloneNode(true) as HTMLElement;
              clone.style.cssText =
                'position:fixed;left:-9999px;top:-9999px;width:' +
                blockEl.offsetWidth +
                'px;opacity:0.7';
              document.body.appendChild(clone);
              dt.setDragImage(clone, blockEl.offsetWidth / 2, 16);
              requestAnimationFrame(() => document.body.removeChild(clone));

              return true;
            },

            // Allow drop on any block element
            dragover: (view, event) => {
              const target = event.target as HTMLElement;
              const blockEl = target.closest('[data-type]');
              if (!blockEl) return false;
              event.preventDefault();
              (event as DragEvent).dataTransfer!.dropEffect = 'move';
              return true;
            },

            // Execute the reorder on drop
            drop: (view, event) => {
              event.preventDefault();
              const dt = (event as DragEvent).dataTransfer;
              const draggedBlockId = dt?.getData('application/x-block-id');
              if (!draggedBlockId) return false;

              const target = event.target as HTMLElement;
              const targetBlockEl = target.closest(
                '[data-type]'
              ) as HTMLElement | null;
              if (!targetBlockEl) return false;

              const targetBlockId = targetBlockEl.dataset.id;
              if (!targetBlockId || targetBlockId === draggedBlockId) return false;

              // Find node positions in the ProseMirror doc
              let draggedPos: number | null = null;
              let targetPos: number | null = null;
              let foundNode: Node | undefined;

              view.state.doc.descendants((node, pos) => {
                if (
                  node.attrs?.id === draggedBlockId &&
                  draggedPos === null
                ) {
                  draggedPos = pos;
                  foundNode = node;
                }
                if (
                  node.attrs?.id === targetBlockId &&
                  targetPos === null
                ) {
                  targetPos = pos;
                }
                return draggedPos === null || targetPos === null;
              });

              if (draggedPos === null || targetPos === null || !foundNode)
                return false;

              const draggedNode = foundNode;
              const tr = view.state.tr;

              // Delete from original position
              tr.delete(draggedPos, draggedPos + draggedNode.nodeSize);

              // Adjust insertion point if the dragged node was before the target
              const adjustedTarget =
                draggedPos < targetPos
                  ? targetPos - draggedNode.nodeSize
                  : targetPos;

              // Insert at new position and select it
              tr.insert(adjustedTarget, draggedNode);
              tr.setSelection(
                Selection.near(tr.doc.resolve(adjustedTarget))
              );

              view.dispatch(tr);
              return true;
            },
          },
        },
      }),
    ];
  },
});
