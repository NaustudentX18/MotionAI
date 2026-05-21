# CRDT Conflict Resolution

## How Y.js CRDTs Work

Y.js uses a CRDT (Conflict-free Replicated Data Type) algorithm. When two peers make concurrent edits, Y.js automatically merges them using vector clocks and operation transforms. No manual conflict resolution is needed.

## Data Model

| Concept | Y.js Type | Key |
|---|---|---|
| Workspace | `Y.Doc` | Root document |
| Pages | `Y.Map<string, Y.Map>` | `pages` (keyed by `pageId`) |
| Blocks | `Y.Array<Y.Map>` | `blocks` inside each page Y.Map |
| Block content | JSON string in `Y.Map` | `blocks-json-${pageId}` |
| Current page ID | `Y.Text` | `currentPageId` |

See `src/lib/yjs.ts` for the full implementation.

## Concurrent Edit Merging

- **Y.Array (blocks list)**: Uses a list CRDT — concurrent inserts are ordered by Lamport timestamp. No conflicts possible.
- **Y.Map (page metadata — title, icon, cover)**: Last-writer-wins for scalar fields. A simultaneous title edit from peer A and peer B will result in one of them "winning" deterministically based on Lamport clock order.
- **Y.Map (block fields)**: Same last-writer-wins semantics for individual block attributes (type, indentLevel, checked, etc.).
- **Y.Text (currentPageId)**: Single-writer register — only the peer that last wrote to it wins.
- **Remote updates**: Applied via `Y.applyUpdate()` from the WebrtcProvider signaling channel (`wss://signaling.yjs.dev`).

The TipTap editor bound to Y.js (`YjsBlockExtension`, `src/lib/extensions/YjsBlockExtension.ts`) stores the entire block document as a JSON string in a `Y.Map<string>`. The CRDT merge is therefore applied at the JSON-string level — Y.js merges the map entry, not individual block fields. The JSON is re-parsed by TipTap on the receiving end.

## Encryption (E2EE)

When E2EE is enabled:

1. User provides workspace passphrase → PBKDF2 key derivation → AES-256-GCM encryption key
2. On every local change: `Y.encodeStateAsUpdate(doc)` → `encryptBinary(state, key)` → stored in IndexedDB under `ydoc_encrypted` object store
3. The encryption key is held in module-level memory only (`workspaceKey`) — **never persisted**
4. On session start, user must provide the passphrase to decrypt and hydrate the `Y.Doc`
5. The in-memory `Y.Doc` is **always plaintext** — CRDT merge operates normally on the decrypted state

See `initEncryptedPersistence()` in `src/lib/yjs.ts` for the full encrypted persistence implementation.

## Edge Cases

- **Wrong passphrase**: `decryptBinary()` throws; the error is caught and the `Y.Doc` starts empty. User sees a blank workspace.
- **Concurrent E2EE peers**: Two peers with different passphrases **cannot sync via WebRTC**. E2EE encrypts the Y.Doc state before it enters the WebrtcProvider. Without a key-exchange protocol, the peers have incompatible ciphertexts. This is a **known limitation** — the WebRTC signaling bridge carries encrypted bytes that each peer can only decrypt with their own key.
- **Legacy migration**: On first unlock with E2EE enabled, if a legacy (non-Y.js) JSON snapshot exists in `WorkspaceSnapshot`, it is migrated into the `Y.Doc` via `snapshotToYDoc()` before encrypted persistence begins.

## References

- Y.js docs: https://docs.yjs.dev
- y-webrtc: https://github.com/yjs/y-webrtc
- CRDT paper: https://arxiv.org/abs/1603.09229
