# Epic round 2 — shipped enhancements

**Branch:** `cursor/readme-splash-redesign-4583`

## UX & polish

- **Sync status dot** in desktop header (saved / saving / offline / locked)
- **Keyboard shortcuts** modal (`?`) plus ⌘⇧J daily journal, ⌘⇧C quick capture
- **Today's journal** in sidebar + daily note helpers wired end-to-end
- **Editor empty states** with one-click templates (journal, meeting, sprint, brainstorm)
- **Backlinks rail** on xl desktop when pages link in
- **Outbound wiki-links** panel section
- **Page addons** auto-open Links tab when backlinks exist
- **`prefers-reduced-motion`** applied on initial load

## Command palette

- **Semantic search** section (vector DB when indexed)
- **Arrow-key navigation** + Enter to open page
- **Preview pane** (desktop) for selected page excerpt

## Mobile PWA

- **Bottom nav:** Home · Search · Capture · AI
- **PWA capture** opens daily note editor via parent `currentPageId`
- **Streaming AI chat** tokens (SSE with JSON fallback)

## Backend

- **`POST /api/ai/chat/stream`** — SSE typewriter stream after generation

## Brand (prior commit)

- Flux mark logo across splash, sidebar, header, PWA icons
