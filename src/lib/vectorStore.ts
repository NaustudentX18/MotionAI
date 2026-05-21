import { Page, Block } from "../types";

// We will use a lightweight embedding model
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

let extractor: any = null;

// Initialize the feature extractor
export async function initExtractor() {
  if (!extractor) {
    try {
      const transformers = await import("@xenova/transformers");
      transformers.env.allowLocalModels = false;
      extractor = await transformers.pipeline("feature-extraction", MODEL_NAME);
    } catch (err) {
      console.error("Failed to initialize transformers", err);
      throw err;
    }
  }
  return extractor;
}

// Generate embeddings for a given text text
export async function getEmbedding(text: string): Promise<number[]> {
  const ext = await initExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

const CHUNK_SIZE = 5;

// Global Voy instance for the client-side vector DB
let voyIndex: any = null;

export interface SearchResult {
  id: string; // The block ID or page ID chunk
  pageId: string;
  blockId: string;
  text: string;
  score: number;
}

// Document chunk structure
interface BaseVoyDocument {
  id: string;
  title: string;
  url: string; // we will use this for storing pageId / blockId "pageId|blockId"
  embeddings: number[];
}

function chunkPage(page: Page, seenContent: Set<string>): BaseVoyDocument[] {
  const chunks: BaseVoyDocument[] = [];
  const pageTitle = page.title || 'Untitled';

  // Group blocks into semantic sections
  // Headings start new sections; consecutive text blocks are grouped
  let currentSectionBlocks: Block[] = [];
  let currentSectionTitle = pageTitle;

  for (const block of page.blocks) {
    // Headings start a new section
    if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
      // Flush current section
      if (currentSectionBlocks.length > 0) {
        const chunk = createChunk(currentSectionBlocks, pageTitle, currentSectionTitle, seenContent);
        if (chunk) chunks.push(chunk);
      }
      currentSectionBlocks = [block];
      currentSectionTitle = stripHtml(block.content || '');
    } else if (block.content && block.content.trim()) {
      // Add to current section (skip dividers and empty blocks)
      currentSectionBlocks.push(block);
    }
  }

  // Flush last section
  if (currentSectionBlocks.length > 0) {
    const chunk = createChunk(currentSectionBlocks, pageTitle, currentSectionTitle, seenContent);
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

function createChunk(blocks: Block[], pageTitle: string, sectionTitle: string, seenContent: Set<string>): BaseVoyDocument | null {
  const parts: string[] = [];

  for (const block of blocks) {
    const typePrefix = getTypePrefix(block.type);
    const text = stripHtml(block.content || '').trim();
    if (text) {
      parts.push(`${typePrefix} ${text}`);
    }
  }

  if (parts.length === 0) return null;

  const chunkText = `[Page: ${pageTitle}] > ${sectionTitle}\n${parts.join('\n')}`;

  // Deduplication check
  if (seenContent.has(chunkText)) {
    return null;
  }
  seenContent.add(chunkText);

  const id = `chunk-${blocks[0].id}-${Date.now()}`;

  return {
    id,
    title: chunkText,
    url: `${pageTitle}|${blocks[0].id}`,
    embeddings: [],
  };
}

function getTypePrefix(type: string): string {
  const map: Record<string, string> = {
    p: '[P]',
    h1: '[H1]',
    h2: '[H2]',
    h3: '[H3]',
    bullet: '[LIST]',
    todo: '[TODO]',
    code: '[CODE]',
    quote: '[QUOTE]',
    callout: '[CALLOUT]',
    divider: '[DIVIDER]',
    'ai-summary': '[AI]',
    'ai-draft': '[AI]',
    'ai-rewrite': '[AI]',
  };
  return map[type] || '[P]';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

async function computeEmbeddingsInChunks(
  items: BaseVoyDocument[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const embeddings = await Promise.all(
      chunk.map((item) => getEmbedding(item.title)),
    );
    embeddings.forEach((emb, j) => {
      items[i + j].embeddings = emb;
    });
    onProgress?.(Math.min(i + CHUNK_SIZE, items.length), items.length);
  }
}

export async function initVectorDB(pages: Page[]) {
  if (voyIndex) return voyIndex;

  const { Voy } = await import("voy-search");

  // Extract all text chunks from pages
  const items: BaseVoyDocument[] = [];
  const seenContent = new Set<string>(); // For deduplication

  for (const page of pages) {
    const pageChunks = chunkPage(page, seenContent);
    items.push(...pageChunks);
  }

  // Pre-compute embeddings in chunks for better performance
  await computeEmbeddingsInChunks(items, (done, total) => {
    console.log(`[vector] Embedding progress: ${done}/${total}`);
  });

  // Define the resource payload for voy
  const resource = {
    embeddings: items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      embeddings: item.embeddings,
    })),
  };

  voyIndex = new Voy(resource);
  return voyIndex;
}

export async function addOrUpdateBlock(page: Page, block: Block) {
  if (!voyIndex || !block.content.trim()) return;

  const pageTitle = page.title || 'Untitled';
  const typePrefix = getTypePrefix(block.type);
  const text = stripHtml(block.content || '').trim();
  const textContext = `[Page: ${pageTitle}] > ${pageTitle}\n${typePrefix} ${text}`;
  const embeddings = await getEmbedding(textContext);

  voyIndex.add({
    embeddings: [
      {
        id: block.id,
        title: textContext,
        url: `${pageTitle}|${block.id}`,
        embeddings,
      },
    ],
  });
}

export async function semanticSearch(
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  if (!voyIndex) {
    return [];
  }
  const queryEmbedding = await getEmbedding(query);
  const results = voyIndex.search(queryEmbedding, limit);

  // The structure of voy results depends on how we fed it.
  // It returns chunks with { id, title, url, similarity? }
  if (results && results.neighbors) {
    return results.neighbors.map((n: any) => {
      const [pageId, blockId] = (n.url || "").split("|");
      return {
        id: n.id,
        pageId,
        blockId,
        text: n.title, // we only stored title there, to get text we'd need to lookup the actual block or we could've stored it in title/url
        score: n.nodeType || n.distance || 0,
        // since voy returns slightly different payload based on version, let's keep it simple
      };
    });
  }
  return [];
}
