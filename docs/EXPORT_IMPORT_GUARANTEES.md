# Export and Import Guarantees

This document defines what Phase 1 export/import must guarantee for MotionAI. It is grounded in the current implementation in `src/components/DriveModal.tsx`, `src/components/BlockEditor.tsx`, `src/lib/workspace.ts`, `src/lib/persistence.ts`, `src/lib/yjs.ts`, and the tests in `scripts/import-export-tests.ts`, `scripts/migration-tests.ts`, and `scripts/workspace-mock-tests.ts`.

## Current surfaces

| Surface | Current implementation | Current guarantee |
| --- | --- | --- |
| JSON workspace backup | Pure helpers in `src/lib/workspaceImportExport.ts`; tested by `scripts/import-export-tests.ts` | Level A `motionai.workspace` JSON envelope round-trips supported workspace fields, rejects unsupported schema versions, repairs append collisions, returns recovery snapshots for explicit replace, and refuses obvious secret-like exports. Not yet wired to UI. |
| JSON workspace snapshot | `WorkspaceSnapshot` in `src/lib/yjs.ts` / `src/lib/persistence.ts`; tested by `scripts/import-export-tests.ts` | Compatibility shape for in-memory/runtime projection. Bare snapshots are accepted as legacy import input and normalized by the Level A helpers. |
| Google Drive text export | `DriveModal.handleExport()` | Exports the current page as plain text to a Google Drive `.txt` file created by this app. Formatting is lossy. |
| Google Drive import | `DriveModal.handleImport()` | Imports Google Docs/text as one paragraph block per non-empty line. Formatting is lossy. |
| PDF export | `BlockEditor.exportPageAsPdf()` | Renders the current page DOM to a PDF. Intended for human-readable output, not re-import. |
| Legacy local load | `loadWorkspace()` in `src/lib/persistence.ts` | Reads legacy snapshots/page arrays and migrates into Yjs on first load. |
| Yjs state backup | `getDocState()` / `applyDocState()` | Binary Yjs update round-trip for internal sync/encryption use, not a portable user-facing import format yet. |

Phase 1 should separate **lossless workspace backup/restore** from **lossy document export/import**.

## Guarantee levels

### Level A: lossless workspace backup/restore

A Level A export is a versioned JSON envelope as specified in `docs/WORKSPACE_SCHEMA.md`. It must round-trip every supported `WorkspaceSnapshotV1` field:

- workspace `currentPageId`
- all pages and stable ids
- page metadata: `title`, `icon`, `cover`, `createdAt`, `updatedAt`, `pageType`
- every supported block type
- block ids and order
- block content
- block options: `checked`, `indentLevel`, `style`, `comments`, `aiPrompt`, `aiContext`, `language`
- page `versions`

Level A export/import is the only format allowed to claim backup, restore, or migration safety.

### Level B: structured page interchange

A Level B export preserves one page with enough metadata to recreate it as a page in a workspace. This is suitable for future `.motionai-page.json` files.

Required fields:

```ts
interface PageEnvelopeV1 {
  schema: 'motionai.page';
  schemaVersion: 1;
  exportedAt: string;
  page: PageV1;
}
```

Guarantees:

- All `PageV1` fields round-trip.
- Import creates a new page id by default to avoid overwriting existing pages.
- Import may offer an explicit overwrite mode, but overwrite must be user-confirmed and must create a page version first.

### Level C: lossy human-readable export/import

Current Drive text export/import and PDF export are Level C.

Guarantees:

- No claim of lossless restore.
- Text export should preserve reading order and obvious Markdown-ish cues for headings, todos, bullets, quotes, callouts, code fences, and dividers.
- Text import creates valid paragraph blocks from non-empty lines.
- PDF export creates a visual artifact for sharing/printing and is not an import source.

## Format-specific guarantees

### Workspace JSON export (`motionai.workspace`, Level A)

Implemented pure API:

- `src/lib/workspaceImportExport.ts` exports `exportWorkspaceJson(snapshot, options)` and `importWorkspaceJson(raw, options)`.
- The file format is a two-space-indented JSON envelope with `schema: 'motionai.workspace'`, `schemaVersion: 1`, `exportedAt`, `appName: 'MotionAI'`, `source`, and `workspace`.
- `append` is the safe default behavior for callers to expose in UI. It preserves existing pages, appends imported pages, rewrites colliding imported page ids, updates imported `currentPageId`, and rewrites imported `parentId` references that point at renamed imported pages.
- `replace` is explicit and returns a `recoverySnapshot` when the caller provides the existing workspace. UI wiring must save or download that recovery snapshot before destructive restore.
- Future envelope versions throw `UnsupportedWorkspaceSchemaVersionError`; legacy bare `{ pages, currentPageId }` snapshots import with a warning.
- Export serializes only workspace data fields and scans the final JSON for obvious provider-key/token/passphrase patterns before returning bytes.
- These helpers are credential-free and do not touch Google Drive, provider keys, passphrases, localStorage, IndexedDB, Yjs, or PDF/text export paths.

Required behavior:

1. Export from the current Yjs document, not stale React state: call `yDocToSnapshot(getYDoc())` or an equivalent fully-synced projection.
2. Wrap the snapshot in `WorkspaceEnvelopeV1`.
3. Validate before download/upload.
4. Use stable, deterministic JSON with two-space indentation for human inspection.
5. Do not include passphrases, OAuth tokens, provider API keys, keychain contents, or raw access tokens.
6. Do not include transient UI state such as sidebar state, modal state, selection, scroll positions, presence peers, or AI provider status.
7. If encrypted-at-rest mode is active, export still requires explicit user action. The exported JSON should be plaintext unless a separate encrypted export format is intentionally implemented.

Suggested filename:

```text
motionai-workspace-YYYY-MM-DDTHH-mm-ssZ.json
```

Import behavior:

1. Parse JSON with size limits.
2. Migrate via the versioned migration pipeline.
3. Validate all required fields.
4. Normalize safe legacy data as specified in `docs/WORKSPACE_SCHEMA.md`.
5. Before replacing the current workspace, create a recovery export or local snapshot.
6. Write through `snapshotToYDoc()` / `saveWorkspace()` so Yjs, IndexedDB, local fallback, and backlinks are consistent.
7. Rebuild backlinks via `backlinksIndex.rebuildFromPages()` after import.
8. Set `currentPageId` only if it exists after migration.

Conflict behavior:

- Default import mode is **append**, not replace.
- Append mode rewrites imported page ids that collide with existing ids and updates internal references that depend on page ids.
- Replace mode is destructive and must be explicit in UI copy.
- If any page title collides, preserve both titles; do not auto-merge by title.

### Page JSON export (`motionai.page`, Level B)

Required behavior:

- Export exactly one `PageV1` from the current workspace.
- Include versions by default because `scripts/import-export-tests.ts` treats versions as part of the page round-trip contract.
- On import, generate a new page id unless user selects overwrite.
- If the imported page has `pageType: 'canvas'`, import it as canvas only if the canvas contract exists; otherwise reject with a clear unsupported-page-type error.

### Google Drive text export (current Level C)

Current code path:

- UI: `src/components/DriveModal.tsx`
- Auth and Drive calls: `src/lib/workspace.ts`
- Folder layout: `MotionAI Workspace` root with subfolders `📂 Projects & Work`, `📂 Personal & Life`, `📂 Meetings & Agendas`, and `📂 AI Content & Drafts`
- File creation: `createGoogleDriveFile(title, plainText, parentFolderId?)`, which creates `${title}.txt`

Current mapping:

| Block type | Text export mapping |
| --- | --- |
| `h1` | `# ${content}` |
| `h2` | `## ${content}` |
| `h3` | `### ${content}` |
| `todo` | `[x] ${content}` or `[ ] ${content}` |
| `bullet` | `- ${content}` |
| `quote` | `> ${content}` |
| `callout` | `[Callout] ${content}` |
| `code` | fenced code block using `language || 'javascript'` |
| `divider` | `---` |
| default | content with inline HTML tags stripped |

Guarantees:

- Export requires Google auth. `src/lib/workspace.ts` centralizes this through `requireGoogleAccessToken()`.
- Export creates app-owned Drive files/folders; it must not hardcode bearer tokens.
- Export is lossy: style, comments, ids, versions, `aiPrompt`, `aiContext`, and some inline formatting are not guaranteed.
- The UI should label this as text export, not backup.

Phase 1 hardening:

- Escape or normalize file names before Drive upload.
- Preserve all heading levels already supported by `BlockType`, including `h3`.
- Add tests for the block-to-text mapping without calling Google APIs.
- Make the lossy guarantee visible in UI copy if this is exposed as an export option.

### Google Drive import (current Level C)

Current code path:

- `listGoogleDriveFiles()` lists Google Docs, `text/plain`, and `application/json` files.
- `getGoogleDriveFileContent(fileId, mimeType)` downloads text or exports Google Docs as plain text.
- `DriveModal.handleImport()` splits on `\n`, drops empty lines, and creates paragraph blocks with new UUIDs.

Guarantees:

- Import creates a new page; it must not overwrite the current page.
- Imported blocks are valid `BlockV1` paragraphs.
- Empty files produce one empty paragraph block.
- Formatting is lossy by design.

Phase 1 hardening:

- If a listed file has `application/json`, sniff for `motionai.workspace` or `motionai.page` envelope before falling back to plain-text import.
- Reject unsupported JSON with a clear error instead of importing raw JSON lines as prose.
- Add size limits and user-facing parse errors.
- Keep Drive imports credential-free in tests by testing parser functions separately from `fetch`.

### PDF export (current Level C)

Current code path:

- `src/App.tsx` dispatches `export-pdf`.
- `src/components/BlockEditor.tsx` listens for that event and calls `exportPageAsPdf()`.
- Export uses `html2canvas` and `jsPDF` to render `#workspace-page-content`, hiding `.pdf-exclude` controls.

Guarantees:

- PDF export is a visual artifact only.
- It is not expected to preserve ids, comments, versions, styles as structured data, AI metadata, or importability.
- Export should not mutate workspace content.

Phase 1 hardening:

- Ensure interactive controls are restored after exceptions.
- Add a smoke test or static check for the event path if PDF remains a supported export surface.

## Import safety invariants

All import paths must satisfy these invariants:

1. **No silent destructive replace.** Any operation that replaces the current workspace or current page must be explicit and recoverable.
2. **Stable ids unless collision repair is needed.** Preserve ids for restore; rewrite ids for append collisions.
3. **No secret import/export.** Provider keys, OAuth tokens, passphrases, and keychain records are outside workspace data.
4. **No executable content.** HTML in block content must be sanitized before rendering. JSON import must not evaluate code.
5. **Deterministic validation.** The same input should produce the same normalized result and warnings, ignoring timestamps generated for missing values.
6. **Clear lossiness labels.** Plain text, Google Doc, and PDF paths must not be represented as full backups.
7. **Credential-free tests.** Parser, serializer, migration, and mapping tests must run without Google auth or browser-only secrets.

## Implementation-ready API sketch

Add pure helpers before UI wiring. Level A workspace backup/restore now exists in `src/lib/workspaceImportExport.ts`:

```ts
export type ImportMode = 'append' | 'replace';
export function exportWorkspaceJson(snapshot: WorkspaceSnapshot, options?: ExportWorkspaceOptions): WorkspaceExportResult;
export function importWorkspaceJson(raw: string, options: ImportWorkspaceOptions): WorkspaceImportResult;
```

Level B page JSON and Level C plain text parser helpers remain future work and must stay separate from the Level A workspace backup path.

Test these helpers directly, then connect them to `DriveModal`, browser download UI, or future file-open UI.

## Required Phase 1 tests

Extend existing scripts or add focused test files without touching package scripts unless coordinated with the repo owner:

1. `WorkspaceEnvelopeV1` export/import round-trip.
2. Legacy bare snapshot import.
3. Future `schemaVersion` rejection.
4. Append import with colliding page ids.
5. Replace import recovery snapshot hook or explicit confirmation boundary.
6. Plain text export mapping for every `BlockType` in `src/types.ts`.
7. Plain text import empty-file behavior.
8. JSON Drive import sniffing: workspace envelope, page envelope, unsupported JSON.
9. Secret-redaction assertion: exported JSON contains no obvious `AIza`, `ya29.`, `sk-`, or saved passphrase strings.
10. Backlinks rebuild call after workspace import.

## Suggested follow-up sequencing

1. Update `yDocToSnapshot()` projection so migrated TipTap JSON pages still produce `blocks` in snapshots.
2. Add UI copy that distinguishes backup JSON from lossy text/PDF export.
3. Wire Level A JSON download/import locally using `src/lib/workspaceImportExport.ts`.
4. Teach Drive JSON import/export to use Level A/Level B envelopes when the selected file is JSON.
5. Add separate Level B page JSON and Level C plain-text parser helpers without mixing them into backup/restore.
