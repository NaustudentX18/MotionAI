# 🎯 MotionAI Extended Roadmap & Todo List

This document outlines the next major phase of development for MotionAI. These items target the core gaps identified in our codebase audit, focusing on desktop integration, spatial UI enhancement, local security, collaborative resilience, and advanced automation.

---

## 🗺️ Master Todo List & Swarm Action Items

### 🌐 1. Collaborative Sync & WebRTC Resilience (Phase 1/2 Hardening)
- [ ] **Simulated Offline Conflict Resolution Tests:** Write E2E/integration tests simulating intermittent socket disconnects, checking Y.js doc convergence when multiple tabs edit the same block offline and reconnect.
- [ ] **Signaling Auto-Discovery / Fallbacks:** Implement custom ICE/STUN server configuration settings in the UI to prevent signaling server disconnects on strict firewalls.
- [ ] **Peer Connection Dashboard:** Design a status popover showing connected peers, signal strength/latency, and current synchronization percentage.

### 💻 2. Tauri Desktop Packager & Keychain Moat (Phase 7 Hardening)
- [ ] **Keychain/Keyring Credential Storage:** Integrate native keychain (using Tauri's storage plugins) to securely save the `MOTIONAI_API_KEY` and other sensitive provider keys locally.
- [ ] **Desktop Native File Import/Export:** Bridge Tauri's native folder dialogs with `workspaceImportExport.ts` to allow users to export backups directly to arbitrary local folders or external drives.
- [ ] **Auto-Update Pipeline:** Establish GitHub Actions packaging with signed release configs and an auto-update payload repository.

### 📊 3. Interactive Backlinks Graph Visualizer (Phase 2 Enhancement)
- [ ] **Visual Node Graph:** Build an interactive canvas or SVG-based network graph mapping page relationships, backlinks, and wiki-link paths (using lightweight custom force-directed layout).
- [ ] **Graph Explorer UI:** Add a collapsible panel to the page footer that allows clicking nodes to navigate between related pages.

### 🎙️ 4. AI Meeting-Notes-to-Tasks Parser (Phase 4 Enhancement)
- [ ] **Transcript Extraction Engine:** Add an AI command endpoint `/api/ai/meeting-parser` that parses meeting minutes and transcripts, automatically formatting actions into database tasks with due dates, priorities, and assignees.
- [ ] **Action Items Preview UI:** Display the generated checklist before writing it to the workspace block graph, allowing users to select/deselect tasks.

### 🎨 5. AI Spatial Canvas Actions (Phase 6 Hardening)
- [ ] **Sticky Note Clustering:** Implement an AI action to group canvas sticky notes by semantic similarity (clustering related ideas together on the canvas grid).
- [ ] **Canvas-to-Task Conversion:** Allow dragging a lasso over multiple canvas elements and converting the selected cards/notes into a structured database list.

### 🔒 6. Local Multi-User Security & Permission Rules (Phase 3 Hardening)
- [ ] **Guest Space Token Rules:** Define read-only / read-write space tokens in Y.js, allowing self-hosted teams to share read-only document folders with external clients.
- [ ] **Local Auth Lockscreen:** Implement a PIN-code/password lock screen inside the PWA client, storing salt/hash in local storage to prevent unauthorized local device viewing.

### 🔔 7. Push Notifications Pipeline (Phase 3 Enhancement)
- [ ] **HTML5 Push API Integration:** Configure a service worker push subscription handler to trigger native mobile/desktop notifications when a reminder date is reached, even if the tab is inactive.
- [ ] **Tauri Local Notifications:** Wire task reminders to Tauri's local system notifications API for desktop popups.

### ⚡ 8. Two-Tap Quick Capture Shell (Phase 7 Enhancement)
- [ ] **iOS Action Extension Compatibility:** Optimize PWA load time and route layouts to support a `/capture` quick-note viewport with a sub-second startup budget.
- [ ] **Voice-to-Text Auto-Save:** Create a dedicated audio widget that transcribes voice memos directly to a new inbox note without manual save buttons.
