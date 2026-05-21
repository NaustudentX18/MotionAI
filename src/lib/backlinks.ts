/**
 * Extract [[WikiLink]] references from text content.
 * Matches [[Page Title]] patterns.
 */
export function parseWikiLinks(text: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}
