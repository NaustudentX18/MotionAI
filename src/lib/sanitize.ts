const BLOCKED_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);

const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BR',
  'CODE',
  'DEL',
  'DIV',
  'EM',
  'I',
  'LI',
  'OL',
  'P',
  'S',
  'SPAN',
  'STRIKE',
  'STRONG',
  'U',
  'UL'
]);

const ALLOWED_GLOBAL_ATTRIBUTES = new Set(['class', 'title']);
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const ALLOWED_STYLE_PROPERTIES = new Set([
  'background-color',
  'border',
  'border-color',
  'border-radius',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'text-decoration',
  'white-space'
]);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeStyle(style: string): string {
  return style
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const separatorIndex = part.indexOf(':');
      if (separatorIndex === -1) return '';

      const property = part.slice(0, separatorIndex).trim().toLowerCase();
      const value = part.slice(separatorIndex + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) return '';
      if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return '';

      return `${property}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
}

function unwrapElement(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  if (BLOCKED_CONTENT_TAGS.has(element.tagName)) {
    element.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(element.tagName)) {
    unwrapElement(element);
    return;
  }

  Array.from(element.attributes).forEach(attr => {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      return;
    }

    if (name === 'href' && element.tagName === 'A') {
      try {
        const url = new URL(value, window.location.origin);
        if (ALLOWED_LINK_PROTOCOLS.has(url.protocol)) {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noreferrer noopener');
          return;
        }
      } catch {
        // Drop malformed hrefs below.
      }
      element.removeAttribute(attr.name);
      return;
    }

    if (name === 'style') {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) {
        element.setAttribute('style', safeStyle);
      } else {
        element.removeAttribute(attr.name);
      }
      return;
    }

    if (ALLOWED_GLOBAL_ATTRIBUTES.has(name)) return;

    element.removeAttribute(attr.name);
  });
}

export function sanitizeHtml(html: string): string {
  if (!html) return html;

  if (typeof document === 'undefined') {
    return escapeHtml(html);
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT
  );
  const nodes: Node[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(sanitizeNode);

  return template.innerHTML;
}
