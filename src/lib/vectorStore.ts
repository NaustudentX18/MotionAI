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

export async function initVectorDB(pages: Page[]) {
  if (voyIndex) return voyIndex;

  const { Voy } = await import("voy-search");

  // Extract all text chunks from pages
  const items: BaseVoyDocument[] = [];

  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.content && block.content.trim().length > 0) {
        items.push({
          id: block.id,
          title: `[Page: ${page.title || "Untitled"}] ${block.content}`,
          url: `${page.id}|${block.id}`,
          embeddings: [], // Will be mapped later, but we need to do this efficiently
        });
      }
    }
  }

  // Pre-compute embeddings (in a real app you'd batch this and show a progress bar or background worker)
  // For demo, we are doing sequentially to not freeze the browser totally on huge data
  // But wait, it's better to do it one by one or on demand.

  // Actually, computing all of them at once can take 10s of seconds if there are many pages.
  // We'll compute them for the current state.
  for (let i = 0; i < items.length; i++) {
    const textContext = items[i].title;
    items[i].embeddings = await getEmbedding(textContext);
  }

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

  const textContext = `[Page: ${page.title || "Untitled"}] ${block.content}`;
  const embeddings = await getEmbedding(textContext);

  voyIndex.add({
    embeddings: [
      {
        id: block.id,
        title: textContext,
        url: `${page.id}|${block.id}`,
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
