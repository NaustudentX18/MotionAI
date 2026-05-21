import { useRef, RefObject } from 'react';

export function useBlockScroll() {
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});

  const focusBlock = (id: string, atEnd: boolean = true) => {
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (atEnd) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }, 0);
  };

  return { blockRefs, focusBlock };
}

export type BlockRefs = RefObject<Record<string, HTMLElement | null>>;
