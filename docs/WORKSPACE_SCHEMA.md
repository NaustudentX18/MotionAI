# Workspace Schema Specification

This document is the Phase 1 implementation contract for MotionAI workspace data. It is grounded in the current source of truth in `src/types.ts`, `src/lib/yjs.ts`, `src/lib/yjs-migration.ts`, `src/lib/persistence.ts`, and the contract tests in `scripts/import-export-tests.ts` and `scripts/migration-tests.ts`.

## Status and scope

- **Current canonical runtime store:** a Yjs `Y.Doc` persisted by `y-indexeddb` in `src/lib/yjs.ts`.
- **Current compatibility snapshot:** `WorkspaceSnapshot`, re-exported from `src/lib/persistence.ts`, with `{ pages, currentPageId }`.
- **Legacy stores still read:** old IndexedDB/localStorage snapshot formats in `src/lib/persistence.ts`.
- **Phase 1 goal:** make schema changes explicit, migratable, and testable before adding richer export/import formats.

This spec describes the contract implementers should target. Where current code is less strict than this spec, the spec defines the Phase 1 hardening work.

## Versioning model

### Add an envelope for durable exports and backups

`WorkspaceSnapshot` is currently a plain object. Phase 1 should keep that type as the in-memory compatibility shape but wrap all user-visible export/import and future backup files in a versioned envelope:

```ts
interface WorkspaceEnvelopeV1 {
  schema: 'motionai.workspace';
  schemaVersion: 1;
  exportedAt: string; // ISO-8601 UTC
  appName: 'MotionAI';
  appVersion?: string;
  source: 'local' | 'google-drive' | 'test' | 'unknown';
  workspace: WorkspaceSnapshotV1;
}

interface WorkspaceSnapshotV1 {
  pages: PageV1[];
  currentPageId: string | null;
}
```

Rules:

1. `schema` and `schemaVersion` are required for new durable files.
2. A bare `{ pages, currentPageId }` object is accepted as **legacy snapshot input** and normalized to `WorkspaceEnvelopeV1` internally.
3. Unknown top-level envelope fields must be preserved when possible but must not affect migration decisions.
4. Unknown page/block fields should be preserved in the Yjs object graph only if the writer intentionally stores extension metadata; otherwise ignore them on import and warn.
5. `schemaVersion` is an integer. Minor additive changes do not require a new major version if old readers can ignore them safely.

### Version bump triggers

Increment `schemaVersion` when any of these change:

- Required fields are added, removed, or renamed.
- Block type semantics change.
- Object identity rules change.
- Current Yjs key layout changes (`pages`, `currentPageId`, `blocks-json-${pageId}`, `blocks-${pageId}`).
- Export/import validation becomes stricter in a way that would reject previously valid files.
- Encryption payload shape changes (`EncryptedData` in `src/lib/crypto.ts`).

Do **not** bump for implementation-only changes that produce the same envelope and snapshot shape.

### Migration semantics

Schema migrations must be deterministic, non-destructive by default, and covered by `npm run test:migration` plus the relevant schema/import-export tests.

Rules:

1. New exporters write the latest supported `schemaVersion`.
2. Importers may accept legacy bare `{ pages, currentPageId }` snapshots and normalize them into the current envelope contract with warnings.
3. Future `schemaVersion` values must fail clearly instead of best-effort importing unknown data.
4. Invalid references such as a missing `currentPageId` are normalized only when the import path explicitly defines a safe repair; otherwise validation fails.
5. Any destructive replacement must be explicit and recoverable. Append/collision repair is the default user-facing import behavior.
6. Unsupported/prototype runtime types must either be accepted by the schema because the runtime can already create them, or be downgraded/rejected with a specific warning before public claims are made.
7. Migration tests should include at least one legacy snapshot, one corrupt snapshot, one invalid-reference repair/rejection case, and one current-envelope round trip.


## Object graph

### Root

Runtime root is one `Y.Doc` per workspace. `initYjs(legacySnapshot, key, workspaceId)` chooses the IndexedDB database name:

- unencrypted default: `motionai-ydoc`
- unencrypted workspace-scoped: `motionai-ydoc-${workspaceId}`
- encrypted default: `motionai-ydoc-encrypted`
- encrypted workspace-scoped: `motionai-ydoc-encrypted-${workspaceId}`

The Yjs root keys are:

| Key | Type | Owner | Purpose |
| --- | --- | --- | --- |
| `pages` | `Y.Map<string, Y.Map<unknown>>` | `src/lib/yjs.ts` | Page metadata and legacy block arrays, keyed by page id. |
| `currentPageId` | `Y.Text` | `src/lib/yjs.ts` | Current selection register. Empty string means `null` in snapshots. |
| `blocks-json-${pageId}` | `Y.Map<string>` | `src/lib/extensions/YjsBlockExtension.ts` | TipTap JSON document serialized in `json`. |
| `blocks-${pageId}` | `Y.XmlFragment` | `src/lib/extensions/YjsBlockExtension.ts` | Per-page fragment used for scoped undo manager. Currently not the canonical content store. |

### WorkspaceSnapshotV1

```ts
interface WorkspaceSnapshotV1 {
  pages: PageV1[];
  currentPageId: string | null;
}
```

Rules:

- `pages` is required and defaults to `[]` only for a valid empty workspace.
- `currentPageId` must be `null` or match an existing `Page.id`. If it does not match, the UI currently falls back to the first page; import code should normalize invalid values to `null` and record a warning.
- Snapshot page order is sorted by `createdAt` in `yDocToSnapshot()`; consumers must not rely on array index as identity.

### PageV1

Current TypeScript source: `Page` in `src/types.ts`.

```ts
interface PageV1 {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  blocks: BlockV1[];
  createdAt: number;
  updatedAt: number;
  versions?: PageVersionV1[];
  pageType?: 'block' | 'canvas' | 'database' | 'dashboard' | 'space' | 'folder';
  parentId?: string | null;
  priority?: 'Urgent' | 'High' | 'Normal' | 'Low';
  dueDate?: string;
  assignee?: string;
  estimatedTime?: number;
  actualTime?: number;
  isTimerRunning?: boolean;
  timerStartTime?: number;
  reminderDate?: string;
}
```

Rules:

- `id` is the stable object identity. New pages are generated with UUIDs in `src/App.tsx`.
- `title` may be `''`; display code may call it `Untitled`.
- `icon` and `cover` are nullable scalars.
- `createdAt` and `updatedAt` are Unix epoch milliseconds.
- `updatedAt` should be advanced on user-visible mutations.
- `pageType` defaults to `'block'` when missing. Runtime-supported page types are `'block'`, `'canvas'`, `'database'`, `'dashboard'`, `'space'`, and `'folder'`; schema validation must stay in lockstep with `PAGE_TYPES` in `src/types.ts`.
- `parentId` models spaces/folders/project hierarchy and must reference another page when used by UI workflows.
- Task metadata (`priority`, `dueDate`, `assignee`, `estimatedTime`, `actualTime`, `isTimerRunning`, `timerStartTime`, `reminderDate`) is canonical page-level metadata. It may be rendered by `TaskPropertiesPanel`, dashboard surfaces, import/export, and Yjs snapshots.
- `reminderDate` is a valid date/datetime string used for local browser/desktop reminder scheduling. It is not a cloud push delivery guarantee.
- `'canvas'` pages currently have no block content contract beyond `blocks: []`.
- `'database'` pages may include a `database` block used by the current database UI.
- `'dashboard'` pages are accepted as an experimental runtime page type so backups do not reject existing user work; public docs must continue to label dashboard behavior conservatively until dedicated tests exist.
- `versions` is local page history only. It is not a CRDT audit log and is not a replacement for export backups.

### PageVersionV1

```ts
interface PageVersionV1 {
  id: string;
  timestamp: number;
  title: string;
  blocks: BlockV1[];
}
```

Rules:

- Versions are snapshots of a page at a point in time.
- Current UI keeps up to 15 versions in `handleSaveSnapshot()`.
- Restoring a version writes `title` and `blocks` back to the page and updates `updatedAt`.

### BlockV1

Current TypeScript source: `Block`, `BlockType`, `BlockStyle`, and `BlockComment` in `src/types.ts`.

```ts
type BlockType =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'todo'
  | 'bullet'
  | 'divider'
  | 'callout'
  | 'quote'
  | 'ai-summary'
  | 'ai-draft'
  | 'ai-rewrite'
  | 'code'
  | 'image'
  | 'database';

interface BlockV1 {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  indentLevel?: number;
  style?: BlockStyleV1;
  comments?: BlockCommentV1[];
  aiPrompt?: string;
  aiContext?: string;
  language?: string;
}
```

Rules:

- `id`, `type`, and `content` are required.
- Runtime-supported block types are defined by `BLOCK_TYPES` in `src/types.ts`; schema validation must use that canonical list so editor/runtime/export contracts do not drift.
- `database` blocks are Level A workspace-backup data and may round-trip through JSON backups. They are not a Level C text/PDF export guarantee.
- `content` is stored as a string. Some legacy/current flows may contain inline HTML; importers must sanitize before render and exporters should strip or encode according to the target format.
- `indentLevel` is hierarchical indentation and should be clamped to `0..4`.
- `checked` only has meaning for `todo`.
- `language` only has meaning for `code`.
- `aiPrompt` and `aiContext` only have meaning for AI block types.
- `comments` are page-local annotations, not threaded collaboration records.

### BlockStyleV1 and BlockCommentV1

```ts
interface BlockStyleV1 {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
}

interface BlockCommentV1 {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}
```

Rules:

- Color fields are CSS color strings. Exporters may preserve them in JSON but plain-text exports may drop them.
- `createdAt` is Unix epoch milliseconds.

## Current Yjs mapping

`src/lib/yjs.ts` currently maps pages and blocks this way:

```text
Y.Doc
├── pages: Y.Map<string, Y.Map>
│   └── <pageId>: Y.Map
│       ├── id: string
│       ├── title: string
│       ├── icon: string | null
│       ├── cover: string | null
│       ├── createdAt: number
│       ├── updatedAt: number
│       ├── versions?: PageVersion[]
│       └── blocks?: Y.Array<Y.Map>          // legacy/current snapshot mirror
├── currentPageId: Y.Text
├── blocks-json-<pageId>: Y.Map<string>
│   └── json: string                         // TipTap JSON document
└── blocks-<pageId>: Y.XmlFragment           // undo-manager scope
```

Important implementation notes:

- `snapshotToYDoc()` rewrites the `pages` map from a snapshot.
- `yDocToSnapshot()` derives the compatibility snapshot from `pages`.
- `savePage()` calls `updatePageInYDoc(page)`, replacing the whole page map.
- `YjsBlockExtension` stores TipTap editor JSON in `blocks-json-${pageId}.json`.
- `migratePageBlocksToFragment()` converts `page.blocks` from legacy `Y.Array<Y.Map>` to TipTap JSON in `blocks-json-${pageId}` and then removes the legacy `blocks` key from the page map.

Phase 1 must resolve the split-brain risk between `page.blocks` and `blocks-json-${pageId}` by defining one canonical write path per page type:

- For block pages, TipTap JSON should become the canonical editor content store.
- `WorkspaceSnapshotV1.pages[].blocks` remains the compatibility/export projection.
- Projection code must be deterministic both directions: `BlockV1[] -> TipTap JSON -> BlockV1[]`.
- `yDocToSnapshot()` must include projected blocks even after `migratePageBlocksToFragment()` deletes the legacy `blocks` key.

## Migration pipeline

### Existing migrations

Current legacy inputs from `src/lib/persistence.ts` and `scripts/migration-tests.ts`:

1. New fallback localStorage snapshot key: `motion_ai_workspace`.
2. Legacy page arrays: `motion_ai_pages`, then `notion_clone_pages`.
3. Legacy current page keys: `motion_ai_current_page_id`, then `notion_clone_current_page_id`.
4. Legacy IndexedDB store: database `open_notion_workspace`, object store `workspace`, key `default`.
5. Encrypted legacy snapshots use `EncryptedData` with `ciphertext`, `iv`, and `salt`.
6. Yjs encrypted state uses database `motionai-ydoc-encrypted[-${workspaceId}]`, store `ydoc_encrypted`, key `y_doc_state`.

Priority order is intentionally conservative: prefer newer whole-workspace snapshots before old page arrays.

### Required migration function shape

Implement migration as pure functions wherever possible:

```ts
interface MigrationResult<T> {
  value: T;
  fromVersion: number | 'legacy';
  toVersion: number;
  warnings: string[];
  repaired: string[];
}

type WorkspaceMigration = (input: unknown) => MigrationResult<WorkspaceEnvelopeV1>;
```

Required behaviors:

- Never mutate the caller's parsed input object.
- Return warnings for dropped unknown fields, repaired invalid current page ids, invalid dates, unknown block types, duplicate ids, or unsupported schema versions.
- Be idempotent: migrating an already-migrated V1 envelope returns an equivalent envelope.
- Reject unsupported future `schemaVersion` by default unless an explicit compatibility mode is passed.
- Keep migration tests credential-free and deterministic.

### Normalization rules

The importer/migrator should repair safe cases and reject unsafe cases:

| Input problem | Action |
| --- | --- |
| Missing `pages` or non-array `pages` | Reject. |
| Missing envelope around valid `{ pages, currentPageId }` | Accept as legacy and wrap. |
| Missing page `id` | Generate a UUID and warn. |
| Duplicate page `id` | Keep first id, rewrite later duplicate ids, update `currentPageId` if needed, warn. |
| `currentPageId` not found | Set `null`, warn. |
| Missing `createdAt`/`updatedAt` | Fill `Date.now()` once for the migration run, warn. |
| `updatedAt < createdAt` | Set `updatedAt = createdAt`, warn. |
| Unknown block `type` | Convert to `p`, keep text content, warn. |
| Missing block `id` | Generate a UUID, warn. |
| Missing block `content` | Use `''`, warn. |
| `indentLevel` outside `0..4` | Clamp and warn. |
| Malformed comments/styles | Drop invalid child entries, warn. |

## Test contract

Existing scripts already cover parts of this spec:

- `scripts/import-export-tests.ts` verifies `WorkspaceSnapshot`, page, block, style, indentation, comments, and versions round-trip through JSON.
- `scripts/migration-tests.ts` verifies legacy snapshot priority and corrupted legacy rejection.
- `scripts/workspace-mock-tests.ts` verifies Drive helper exports and token-gating.

Phase 1 implementation should add/extend tests for:

1. Versioned envelope round-trip.
2. Bare legacy snapshot to envelope migration.
3. Future schema version rejection.
4. Duplicate page/block id repair.
5. `currentPageId` repair.
6. `BlockV1[] <-> TipTap JSON` projection for every block type in `src/types.ts`.
7. Yjs migration idempotency for `migratePageBlocksToFragment()`.
8. `yDocToSnapshot()` preserving blocks after a page has only `blocks-json-${pageId}`.

## Compatibility constraints

- Do not remove `WorkspaceSnapshot` until all current UI and tests are migrated.
- Do not rename legacy localStorage/IndexedDB keys without a read migration.
- Do not make Google Drive import/export depend on secrets in tests; use static/mocked tests as `scripts/workspace-mock-tests.ts` does today.
- Do not store passphrases in workspace data. `workspaceKey`/`Yjs` keys are process memory only, with optional device keychain storage handled separately.
