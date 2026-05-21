import { escapeHtml, sanitizeHtml } from './sanitize';

// Re-export sanitize utilities for use in components
export { escapeHtml, sanitizeHtml };

export const TEXT_COLORS = [
  { name: 'Default', value: 'inherit' },
  { name: 'Gray', value: '#787774' },
  { name: 'Brown', value: '#976D57' },
  { name: 'Orange', value: '#CC4E00' },
  { name: 'Yellow', value: '#C29000' },
  { name: 'Green', value: '#218358' },
  { name: 'Blue', value: '#137CA6' },
  { name: 'Purple', value: '#8F55A3' },
  { name: 'Red', value: '#C23131' },
];

export const BG_COLORS = [
  { name: 'Transparent', value: 'transparent' },
  { name: 'Light Gray', value: '#F1F1F0' },
  { name: 'Brown', value: '#F3ECE9' },
  { name: 'Orange', value: '#FAEBDD' },
  { name: 'Yellow', value: '#FBF3DB' },
  { name: 'Green', value: '#EDF6EC' },
  { name: 'Blue', value: '#E8F4FC' },
  { name: 'Purple', value: '#F3EDF5' },
  { name: 'Red', value: '#FDEBEC' },
];

export function parseMarkdownToHtml(text: string): string {
  if (!text) return text;

  let parsed = text;

  // Bold: **text** or __text__
  parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  parsed = parsed.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  parsed = parsed.replace(/\*([^\*<>]+)\*/g, '<em>$1</em>');
  parsed = parsed.replace(/_([^_<>]+)_/g, '<em>$1</em>');

  // Strikethrough: ~~text~~ or ~text~
  parsed = parsed.replace(/~~([^~<>]+)~~/g, '<del>$1</del>');
  parsed = parsed.replace(/~([^~<>]+)~/g, '<del>$1</del>');

  // Code: `text`
  parsed = parsed.replace(/`([^`<>]+)`/g, (match, p1) => {
    return `<code class="bg-[#F1F1F0] dark:bg-[#2F2F2F] text-[#EB5757] dark:text-[#E06C75] px-1.5 py-0.5 rounded font-mono text-sm border border-[#EBEBE9] dark:border-[#3F3F3F] font-semibold">${p1}</code>`;
  });

  // Multiline lists
  if (parsed.includes('\n')) {
    const lines = parsed.split('\n');
    let insideUl = false;
    let insideOl = false;
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        let prefix = insideUl ? '' : '<ul class="list-disc pl-5 my-1 space-y-0.5">';
        insideUl = true;
        if (insideOl) {
          prefix = '</ol>' + prefix;
          insideOl = false;
        }
        return prefix + `<li class="my-0.5">${trimmed.substring(2)}</li>`;
      } else if (/^\d+\.\s/.test(trimmed)) {
        let prefix = insideOl ? '' : '<ol class="list-decimal pl-5 my-1 space-y-0.5">';
        insideOl = true;
        if (insideUl) {
          prefix = '</ul>' + prefix;
          insideUl = false;
        }
        const match = trimmed.match(/^\d+\.\s(.*)/);
        const liContent = match ? match[1] : trimmed;
        return prefix + `<li class="my-0.5">${liContent}</li>`;
      } else {
        let suffix = '';
        if (insideUl) {
          suffix = '</ul>';
          insideUl = false;
        }
        if (insideOl) {
          suffix = '</ol>';
          insideOl = false;
        }
        return suffix + line;
      }
    });

    if (insideUl) formattedLines.push('</ul>');
    if (insideOl) formattedLines.push('</ol>');
    parsed = formattedLines.join('\n');
  }

  return sanitizeHtml(parsed);
}
