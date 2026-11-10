# V2.2 → V3 implementation baseline

This document is the engineering baseline for the `V2.2-to-V3` branch. It records what is already present in the V2.2 source before new work begins, so later releases extend existing systems instead of duplicating them.

## Repository rules

- Keep `main` unchanged until the branch is reviewed and merged.
- Implement in release order: V2.2 hardening, then V2.3 through V2.9, then V3.0 integration.
- Make commits at feature boundaries. Each commit should describe one feature or tightly related sub-feature.
- Preserve existing profile data and local-first behavior. No browser account or cloud synchronization is introduced.
- Do not claim a capability is complete until its UI, main-process behavior, persistence, security boundary, and tests are all covered.
- Do not silently replace existing browser behavior. Add migrations for persisted data changes and preserve old settings.

## Baseline from the V2.2 source

The source currently includes a sizeable portion of the roadmap already. The statuses below distinguish existing foundations from work that still needs to be implemented and tested.

| Release | Existing foundations in V2.2 | Remaining work to qualify as complete |
|---|---|---|
| V2.2 Advanced Tab Ecosystem | Persistent and temporary containers, profile-specific partitions, domain rules, most-specific rule selection, tab moves, container UI, private/guest handling. | Regression-test isolation, restore, permissions, downloads, and workspace interactions; address documented move/reload state loss where technically possible; document unavoidable session boundaries. |
| V2.3 Media & Downloads | Download history, progress updates, pause/resume/cancel, open/reveal, folder selection, optional automatic category folders, bounded FIFO queue and configurable 1–10 concurrency. | Scheduling, duplicate detection, searchable history, throughput history/graphs, integrity metadata, cleanup rules, and global media controls. Queueing/concurrency has been added on this branch and still needs Electron runtime verification. |
| V2.4 Research & Knowledge | Reader view, notes, collections, page capture, journeys and saved sessions. | Durable article snapshots, offline article reading, selected-section clipping, highlights/annotations, source references, full-text indexing/search, version comparison, and collection export. |
| V2.5 Personalization Studio | Theme presets, accent colors, custom accent, fonts, density, corner styles, tab/sidebar sizing, toolbar visibility/order, new-tab options. | Visual layout editor, workspace-specific appearance profiles, theme import/export/library, custom CSS-variable editor with validation, and preview/rollback. |
| V2.6 Developer & Creator Tools | DevTools access, page source, developer panel, screenshot capture/annotation, PDF export. | Network request inspector, responsive viewport mode, device presets, JSON viewer, font/color inspection, structured page inspector, and creator capture/recording workflows. |
| V2.7 Privacy & Security 2.0 | Filter-list ad blocking, custom rules/lists, site permissions, cookie controls, site data controls, permission expiry, referrer policy, password vault. | Secure DNS/DoH controls, coherent privacy dashboard/audit, extension permission audit, clearer security event reporting, download scanning integration, and security-focused regression tests. |
| V2.8 Application Ecosystem | Unpacked extension management, extension catalog metadata, installed website apps, service shortcuts. | Sandboxed local plugin API, permission model, plugin lifecycle, compatibility/permission analysis, extension collection export/import, and application window/profile controls. |
| V2.9 AI & Automation | Configurable remote AI endpoint, page context, multi-tab comparison, saved browser workflows with allow-listed actions. | Visual workflow editor, reusable workflow validation/versioning, user-confirmed consequential actions, optional local-model adapter, provider privacy controls, and broader document/research workflows. |
| V3.0 Complete Browser | Local backups/import, profile management, recovery/safe mode, engine-adapter foundation, update-manifest checking, existing unified panel/settings foundations. | Full interface unification, Windows integration, robust multi-window lifecycle, migration tooling, signed installer/release pipeline, actual safe auto-update mechanism, performance audit, accessibility and end-to-end release validation. |

## Engineering sequence

### V2.2 — Stabilization
1. Add isolated tests for container domain normalization and rule resolution.
2. Add regression coverage for persistent versus temporary partitions and guest/private exclusions.
3. Verify tab restore and container rule behavior across profile/workspace changes.
4. Fix only confirmed defects; keep the documented limitation for unsaved renderer state if Electron cannot safely migrate it between sessions.

### V2.3 — Media & Downloads
1. Model download jobs and queue state independently from Electron's DownloadItem objects.
2. Add a bounded queue and explicit concurrency setting.
3. Add scheduling and cancellation semantics that survive app restarts safely.
4. Add searchable history, duplicate checks, integrity metadata and throughput sampling.
5. Add media-session controls without exposing privileged APIs to website renderers.

### V2.4 — Research Library
1. Add a versioned local library data model and migrations.
2. Capture sanitized readable article content and metadata with explicit user action.
3. Store snapshots locally and support offline reading.
4. Add annotations, highlights, source references, full-text search and exports.
5. Keep remote AI analysis opt-in and disclose which saved content is sent to a provider.

### V2.5 — Personalization Studio
1. Introduce validated, versioned theme/layout documents.
2. Add import/export and preview/rollback.
3. Add workspace-specific theme selection.
4. Build a drag-and-drop editor over an allow-listed component layout; do not permit arbitrary markup or script execution.

### V2.6 — Developer & Creator Tools
1. Add a dedicated DevTools/network inspection surface using supported Electron/Chromium APIs.
2. Add responsive viewport presets and JSON/font/color inspection.
3. Keep inspection scoped to the active tab and gate privileged actions behind trusted browser UI.

### V2.7 — Privacy & Security
1. Add a privacy dashboard backed by actual browser counters and permission state.
2. Add secure DNS settings only where Electron/Chromium exposes a supportable configuration.
3. Add permission/extension audits and download-security integration points.
4. Add tests for allow/deny behavior, cleanup and data deletion.

### V2.8 — Application Ecosystem
1. Define a versioned plugin manifest and capability-based permissions.
2. Run plugins in isolated contexts; never expose raw IPC or unrestricted Node access.
3. Add lifecycle, install/remove, update and compatibility reporting.
4. Keep website apps and service shortcuts working independently of plugins.

### V2.9 — AI & Automation
1. Separate AI provider adapters from UI and browser orchestration.
2. Add a local-model adapter interface without bundling a model.
3. Build a visual workflow graph over a strict allow-list of browser actions.
4. Require explicit confirmation for form submissions, account changes, downloads from untrusted sources, and other consequential operations.

### V3.0 — Integration and release
1. Unify navigation, settings, panel and command-center information architecture.
2. Complete Windows protocol/default-browser/notification/tray integration where supported.
3. Add explicit data export/import and migration tests.
4. Build signed packaging and a staged update/recovery process.
5. Run clean-install, upgrade, rollback, profile migration, multi-window, performance and accessibility checks.

## Validation policy

The existing repository's README and V2.2 changelog explicitly distinguish source-level checks from Electron runtime testing. That distinction remains mandatory. Syntax checks and unit tests do not prove live Chromium session behavior, extension compatibility, Windows installer correctness, or updater safety. Those require runtime testing on supported Windows/Electron builds.

## Current completion status

- V2.2 source baseline: present; hardening and regression validation remain.
- V2.3: bounded FIFO download queue and configurable concurrency are implemented on this branch; remaining media/download features and Electron runtime verification are outstanding.
- V2.4–V3.0: foundations exist in several areas; remaining work is not yet implemented by this baseline commit.
- No release in this roadmap should be labelled complete solely because its navigation entry or settings control exists.
