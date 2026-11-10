# BrowserApp Firefox / Gecko proof of concept

This is an isolated engineering prototype for validating whether a real Firefox
window can be hosted inside an Electron window. It does not replace Chromium and
is deliberately not wired into the production BrowserApp tab manager yet.

## What this prototype does

1. Locates an installed Firefox desktop executable (or uses FIREFOX_PATH).
2. Starts Firefox with a separate, dedicated profile under Electron's user data
   directory. It never reuses the user's normal Firefox profile.
3. Enables Firefox's local WebDriver BiDi endpoint on a dynamically reserved
   TCP port and connects only to 127.0.0.1.
4. Uses BiDi to navigate the active Firefox browsing context, track navigation
   and load events, query the document title, and capture a screenshot.
5. Uses a persistent PowerShell process and Win32 APIs to find Firefox's native
   window, re-parent it into the Electron host window with SetParent, and
   resize/focus it with SetWindowPos and focus APIs.
6. Provides a small address bar and back/forward/reload controls so the native
   embedding can be exercised without changing the regular browser UI.

## Requirements

- Windows 10 or later (the native host is Windows-specific).
- Firefox desktop installed.
- Node.js 22.12 or newer, matching the Electron 43 runtime baseline.
- The repository dependencies installed with npm install.
- Windows PowerShell 5.1 or PowerShell 7 available as powershell.exe.

If Firefox is installed in a non-standard location, set FIREFOX_PATH to the
full path to firefox.exe before launching the prototype.

## Run it

From the repository root, run:

    npm install
    npm run firefox:poc

A separate window titled **BrowserApp — Firefox Gecko proof of concept** should
open. The top toolbar belongs to Electron. The area below it should be the
actual Firefox window, not a screenshot or a Chromium approximation.

Try a few public HTTPS websites, navigate between them, resize the host window,
and check keyboard focus by typing into the website and the address bar. Close
the POC window to end the managed Firefox process.

The POC stores its isolated Firefox profile under Electron's userData folder
at firefox-poc/profile. The precise userData directory can vary with the
application name and packaging configuration.

## Security notes

- Firefox's remote debugging interface can expose powerful browser controls and
  private session data. The prototype uses a dedicated profile and connects to
  the loopback address only. Do not expose the debugging port to a network.
- The profile is separate from normal Firefox, but it is still a real browser
  profile. Treat it as sensitive and do not use it for private or important
  accounts while testing.
- Website navigation through the POC address bar is restricted to HTTP and
  HTTPS. The prototype does not claim to enforce BrowserApp's full Chromium
  navigation policy on every in-page navigation.
- Do not run untrusted websites or extensions in this experimental build.

## Current limitations — intentionally not hidden

This is a **single Firefox window prototype**, not production dual-engine
support. It does not yet provide:

- Multiple independent Firefox tabs embedded in one BrowserApp window.
- BrowserApp profile/container isolation mapped to Firefox contexts.
- BrowserApp's Chromium download manager, extension manager, permissions,
  cookie controls, ad blocker, network filters or password autofill.
- Full context-menu and popup-window integration.
- BrowserApp's reader mode, page translation injection, site CSS settings,
  developer-tools integration, print-to-PDF or accurate per-tab process
  metrics.
- Verified cross-DPI behavior, fullscreen handling, multi-monitor behavior,
  popup ownership, IME behavior or reliable focus transfer on every Windows
  configuration.

The Win32 SetParent API does not automatically normalize the child window
styles, and Microsoft documents DPI-awareness caveats for cross-process
parenting. The helper explicitly adjusts the window styles and bounds, but the
result must still be tested on real Windows hardware. A successful BiDi
connection alone is not proof that native embedding is reliable.

## Test and validation

Run the JavaScript unit tests:

    npm test

The tests cover executable discovery, navigation URL validation, declared
capability limits and the platform guard for native embedding. They do not
prove that Firefox is installed, that the BiDi handshake succeeds, or that
Windows will accept the cross-process SetParent operation.

The real acceptance checklist is:

- Firefox starts with the dedicated profile and exits when the POC closes.
- The BiDi session is established on loopback and reports a top-level context.
- Address-bar navigation changes the actual Firefox page.
- Page title and loading state update in the Electron toolbar.
- Firefox content remains inside the host window while resizing.
- Keyboard and mouse focus work in the page and return to the address bar.
- The host does not leave an orphaned Firefox process after closing.
- Test at 100%, 125%, 150% display scaling and across at least two monitors.

## Integration decision

Only after the native-window test is reliable should the adapter be considered
for integration into the main BrowserApp. The current main process and browser
services still rely on Electron WebContents and Session behavior in many
places. The next integration stage must introduce explicit capability-aware
service boundaries and either implement or disable unsupported Firefox
features per engine. Do not simply register this prototype adapter in the
production EngineManager and assume the rest of BrowserApp is engine-neutral.
