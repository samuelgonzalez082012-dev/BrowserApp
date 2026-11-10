# Browser engine adapter

## Purpose

The engine adapter separates BrowserApp's tab/page operations from the rendering engine that implements them. The first implementation registers Chromium only. This is an architectural refactor, not a Gecko implementation and not a user-facing engine switch.

## Current architecture

- `engine-adapters/engine-manager.js` owns the adapter registry and creates tab handles by engine ID.
- `engine-adapters/chromium-engine.js` is the only registered backend. It privately owns Electron's `WebContentsView` and `WebContents`.
- Browser tabs store `engineId` and an `engineTab` handle. Main-process tab code uses the handle contract for navigation, events, sizing, page actions and cleanup.

## Engine adapter contract

An adapter registers:

- `id`, `name`, `family`, and `runtime` metadata.
- A `capabilities` object describing features that the backend actually implements.
- `createTab({ contextId, preferences })`, returning a tab handle with the same `engineId`. `contextId` is a stable isolation-context identifier; each engine maps it to its own storage/profile mechanism. `preferences` contains engine-neutral user preferences such as spellcheck.

A tab handle provides:

- Lifecycle: `isDestroyed()`, `close()`.
- Hosting: `attachTo(window)`, `detachFrom(window)`, `setBounds(bounds)`, `focus()`.
- Navigation: `navigate(url)`, `loadInternalFile(path, options)`, `getURL()`, `getTitle()`, `isLoading()`, `navigationHistory`, `reload()`, `stop()`.
- Page events: title, favicon, loading, navigation, failure, media, context menu, DOM ready, crash and cancellable navigation/input events.
- Common page functions: mute, zoom, script enablement, script evaluation, CSS insertion, page capture, PDF output and process metrics.
- Optional developer tools and script enablement, reflected in capabilities. Chromium currently implements script enablement with the Chrome DevTools Protocol internally; that detail is not exposed to the host application.

The host-facing methods are deliberate: a future native Gecko host must decide how its own surface attaches to the application window. Main-process code should not obtain the underlying Electron `WebContentsView`.

## Current limitations (important)

This refactor establishes the tab/rendering boundary, but it does not yet make every BrowserApp subsystem engine-independent.

The Chromium adapter now owns Electron `WebContentsView` construction and its `webPreferences`. The following browser-context and network services still use Electron's `session` and related APIs directly in `main.js`:

- Cookie storage and container/profile partitions.
- Permission grants and site settings.
- Download events and download item management.
- Network interception, tracker blocking and ad-block filtering.
- Extension loading and management.
- Web panels and installed web-app windows.

A Gecko adapter must not claim support for these features until equivalent Gecko services exist. The next architectural step, before a real Gecko backend, is a separate browser-context/network-services adapter for storage, permissions, downloads and request filtering.

## Why Gecko is not registered yet

Electron's `WebContentsView` hosts Electron `WebContents`; it is not a pluggable engine slot. GeckoView is documented as an Android embedding library, while Firefox's desktop embedding internals are not offered as a supported drop-in Windows browser-control SDK. A real Windows Gecko backend therefore needs a separate native-host feasibility prototype before it can be registered here.

## Safety and lifecycle rules

- Unknown engine IDs fail explicitly; they never silently fall back to Chromium.
- Every persistent tab record stores `engineId` so future engines can restore tabs intentionally.
- Engine-specific features must be checked against adapter capabilities.
- Engine adapters own their native view/process and must detach and dispose it when tabs close.
- Do not expose native engine objects to renderer processes or preload APIs.
