/**
 * Secure keychain storage for E2EE workspace keys (Tauri desktop).
 * Falls back gracefully to in-memory only when keychain is unavailable.
 */

export interface KeychainStore {
  storeKey(workspaceId: string, key: string): Promise<void>;
  retrieveKey(workspaceId: string): Promise<string | null>;
  deleteKey(workspaceId: string): Promise<void>;
}

/**
 * Returns true when running inside a Tauri desktop app.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ─── In-memory fallback (web / non-Tauri) ─────────────────────────────────────

const memStore = new Map<string, string>();

const memKeychain: KeychainStore = {
  async storeKey(workspaceId: string, key: string): Promise<void> {
    memStore.set(workspaceId, key);
  },
  async retrieveKey(workspaceId: string): Promise<string | null> {
    return memStore.get(workspaceId) ?? null;
  },
  async deleteKey(workspaceId: string): Promise<void> {
    memStore.delete(workspaceId);
  },
};

// ─── Tauri implementation ─────────────────────────────────────────────────────

const tauriKeychain: KeychainStore = {
  async storeKey(workspaceId: string, key: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('store_key', { workspaceId, key });
  },
  async retrieveKey(workspaceId: string): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('retrieve_key', { workspaceId });
  },
  async deleteKey(workspaceId: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_key', { workspaceId });
  },
};

// ─── Exported singleton ───────────────────────────────────────────────────────

/** Platform-aware keychain. Use this instead of the individual implementations. */
export const keychain: KeychainStore = isTauri() ? tauriKeychain : memKeychain;
