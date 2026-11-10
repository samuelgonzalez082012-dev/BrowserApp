MINIMAL CHROMIUM BROWSER — V2.2 ADVANCED TAB ECOSYSTEM BUILD
================================================================

This is a SOURCE-ONLY Electron Fiddle bundle. It intentionally contains no
package.json, package-lock.json, node_modules, installer, cloud account system,
or synchronization code.

V2.2 is a local-first desktop browser build combining the V1.1–V1.3 browser
foundation with selected V1.4, V1.6, V1.7, V1.8, V1.9 and V2.0 capabilities.
The planned V1.5 cloud synchronization release has been deliberately omitted.
There are no browser accounts, cloud vault backups, cross-device tab sync, or
background sync services in this project.

IMPORTANT PROJECT STATUS
------------------------
The source has passed JavaScript syntax checks, local HTML/CSS asset-reference
checks, the container navigation IPC allow-list check, 13 isolated container
routing/partition assertions, and ZIP integrity checks. This environment cannot
launch Electron Fiddle or exercise live Chromium websites. Treat this as a
development build and run the V2.2 smoke tests below before relying on it with
important data.

ELECTRON FIDDLE SETUP
---------------------
1. Back up your current browser source AND its userData/profile folder.
2. Create/open an Electron Fiddle project using a current Electron release
   compatible with WebContentsView and the APIs used by this source.
3. Copy all supplied files into the Fiddle project root, preserving filenames.
4. Set main.js as the main-process entry point.
5. For full filter-list ad blocking, add these optional dependencies using
   Electron Fiddle's package-management UI:

       @ghostery/adblocker-electron
       cross-fetch

   Without them, the built-in hostname fallback may still block explicitly
   configured custom domains, but it is NOT equivalent to EasyList/EasyPrivacy
   network filtering or cosmetic filtering.
6. Do not enable Node integration for website views. Keep context isolation and
   sandboxing enabled as configured in the source.
7. Run the project. Browser data is stored under Electron's userData folder.

FILES
-----
main.js                 Main process, tabs, windows, profiles, persistence,
                        downloads, privacy, ad blocking, backups, connected
                        service shortcuts, workflows, updates and IPC.
password-vault.js       Local encrypted password-vault implementation.
download-queue.js       Bounded FIFO scheduler for simultaneous downloads.
container-routing.js    Pure container domain normalization and routing helpers.
test/                   Node.js unit tests for engine adapters and container routing.
index.html              Browser chrome, tabs, address bar and toolbar controls.
styles.css              Browser chrome and global visual styling.
renderer.js              Browser UI, tabs, workspace, keyboard shortcuts,
                        command palette and navigation.
preload.js               Restricted preload bridge for the browser chrome.
newtab.html              Local new-tab dashboard.
newtab.css               Dashboard styling.
newtab.js                Dashboard actions and state.
panel.html               Browser management/productivity panel.
panel.css                Panel styles, cards, forms and feature layouts.
panel.js                 Panel renderers and actions, including vault, privacy,
                        services, extension catalog, workflows and diagnostics.
panel-preload.js         Restricted preload bridge for the management panel.
settings.html            Preferences and personalization window.
settings.css             Settings UI styling.
settings.js              Settings validation and persistence.
settings-preload.js      Restricted preload bridge for settings.
reader.html              Reader view document.
reader.css               Reader view styling.
reader.js                Reader view behavior.
capture-editor.html      Screenshot annotation editor.
capture-editor.css       Screenshot editor styling.
capture-editor.js        Screenshot markup and export controls.
sleeping.html            Placeholder shown while an inactive tab is asleep.
crash.html               Local renderer-crash recovery page.
crash.js                 Safe retry logic for a crashed webpage.
V2.2-CHANGELOG.txt       V2.2 additions, limitations and validation summary.

V1.4 — LOCAL PASSWORD VAULT AND IDENTITY
----------------------------------------
- A separate vault file for each permanent browser profile.
- Master password with minimum length and repeated confirmation on setup.
- Password-derived key using scrypt and authenticated encryption using
  AES-256-GCM. Vault entries remain encrypted while the vault is locked.
- Website credential records, secure notes and saved identity records.
- Password generation using Node's cryptographic random source.
- Manual login fill after a native confirmation dialog. Fill is limited to the
  exact saved hostname, requires a normal loaded tab, and does not submit the
  webpage form.
- Encrypted vault export/import, master-password change, delete and reveal.
- Failed unlock throttling and configurable idle auto-lock.
- The vault locks when changing profiles and when the application exits.
- Master passwords are not written into settings or sent to a remote service.

Vault safety notes:
- There is no password reset or recovery server. If the master password is
  forgotten and no unlocked session remains, the encrypted vault is not
  recoverable. Keep an encrypted vault backup in a safe location.
- The app cannot guarantee secure memory erasure in the JavaScript runtime.
  The vault clears its key buffer and in-memory entries when locked, but users
  should close the app and protect their operating-system account.
- Password form autofill is manual and hostname-checked; this is not a full
  password-manager browser integration. It does not detect every login form,
  passkeys, TOTP codes, or save passwords automatically after login.
- Identity records are stored securely but are not automatically injected into
  arbitrary payment or identity forms.

V1.5 — CLOUD SYNCHRONIZATION
----------------------------
INTENTIONALLY NOT INCLUDED.
No cloud sync, browser account, cross-device synchronization, remote password
vault, or sync server exists in this version.

V1.6 — EXTENSION MANAGEMENT AND CATALOG
---------------------------------------
- Load trusted unpacked extensions from a local folder.
- Remember extension folders per profile and attempt to restore them at startup.
- Enable, disable, reload, remove and inspect installed extensions.
- Show declared permission information and basic compatibility warnings.
- Optional HTTPS JSON catalog URL for extension metadata and listing links.
- Catalog entries open their external listing; they are not downloaded or
  installed by the browser.

Electron exposes only a subset of Chrome extension APIs. This project does not
provide full Chrome Web Store compatibility, general CRX package installation,
or guaranteed compatibility with every extension. Review extension source
and permissions before loading an extension.

V1.7 — CONNECTED SERVICE HUB
----------------------------
- A local service hub with shortcuts for common email, calendar, storage,
  documents, design and developer services.
- Installed website applications can be opened from the hub.
- Service shortcuts open the provider website in the browser.

These tiles are NOT native OAuth/API integrations. The browser does not connect
to Gmail, Outlook, Calendar, Drive, Notion, GitHub, etc. through a privileged
account connector, and it does not store those service passwords. Sign in on
the provider's own website and review that provider's data/privacy controls.

V1.8 — PRIVACY AND NETWORK PROTECTION
-------------------------------------
- Existing filter-list ad blocker integration via optional
  @ghostery/adblocker-electron and cross-fetch packages.
- EasyList / EasyPrivacy and optional annoyance filtering where supported by
  the installed filter engine and chosen lists.
- Custom blocked hostnames, HTTPS filter-list URLs, website exceptions,
  temporary site pause, statistics and refresh controls.
- Cosmetic filtering where the installed Ghostery engine and supported
  integration provide it. Private sessions use network filtering and
  temporary counters; they do not receive the same cosmetic integration.
- Cross-origin Referer minimization preference.
- Optional cookie clearing on exit for the active profile.
- Site permissions, cookies/site data management, per-site JavaScript and
  pop-up settings, and per-site zoom are part of the browser foundation.

Privacy limitations:
- Blocking quality depends on filter-list freshness and the optional Ghostery
  package. Some ads are first-party or server-side and cannot be reliably
  identified by request rules. Some rules can break sites.
- The Referer option reduces cross-origin referrer detail; it is not a complete
  fingerprinting defense.
- Cookie clearing signs the active profile out of sites. It does not clear
  every other profile's cookies or erase external backups.
- This is not a VPN, DNS resolver, or system-wide network firewall. No VPN
  provider/service is bundled.

V1.9 — AI AND SAFE BROWSER WORKFLOWS
-----------------------------------
- Existing configured AI assistant can summarize the current page and answer
  questions using page text submitted by the user.
- Multi-tab comparison can pass selected/loaded tab text (up to the code's
  configured limit) to the configured AI endpoint.
- User-defined browser workflows can sequence approved built-in browser actions
  such as opening URLs, creating tabs, saving sessions, capturing pages or
  opening browser panels.
- Workflows cannot execute arbitrary JavaScript, shell commands, or silently
  submit website forms.

AI privacy/cost notes:
- AI is optional and requires a configured OpenAI-compatible endpoint/model
  and API key. The provider may charge for usage.
- When an AI action is submitted, page text selected by the feature is sent to
  the configured provider. Do not submit sensitive pages unless you trust the
  provider and understand its data policy.
- No local AI model is bundled.

V2.0 — LOCAL-FIRST PRODUCT POLISH
--------------------------------
- Unified About/Release section and local-first product messaging.
- Unified password, services, automations, privacy, developer and update
  management panels.
- Existing V1.2 workspace, tab-group, split-screen, notes, collections,
  sessions, journeys, web-panel, notification, reader and capture tools remain
  part of the source bundle.
- Custom update manifest checking can report an available version and open its
  HTTPS download URL.
- Local profile storage and backup recovery remain the default model.

V2.0 capabilities not shipped in this build:
- No cloud synchronization or browser account system (by request).
- No native email/calendar provider OAuth integration; service tiles are links.
- No official extension marketplace backend or one-click CRX installer.
- No VPN service or provider contract.
- No automatic self-updater. The update checker reads a manifest and opens a
  download link. Production automatic update/install requires a packaged,
  properly signed app and configured release feed.
- No full Chromium source fork or independently maintained browser engine.
- No mobile app in this desktop bundle.

SECURITY AND DATA HANDLING
-------------------------
- Keep Node integration disabled for website views.
- Keep context isolation and renderer sandboxing enabled.
- The browser UI communicates with the main process using explicit preload
  bridges and IPC actions. Do not expose unrestricted IPC to webpages.
- Keep Electron current and only install extensions/packages from trusted
  sources.
- Backups can contain browsing history, bookmarks, notes, workspaces and
  profile settings. Store backup files securely. Password vault backup is a
  separate encrypted file. AI keys and active website cookies are excluded
  from portable profile backup exports.

VALIDATION PERFORMED FOR THIS SOURCE BUNDLE
-------------------------------------------
- Node syntax check on every JavaScript source file.
- Local HTML script/style/image reference audit.
- ZIP integrity check.
- Isolated password vault functional test: create, encrypted save, incorrect
  password rejection, unlock, reveal, export, import and re-unlock.

NOT PERFORMED HERE
------------------
- Electron Fiddle runtime launch or live Chromium website testing.
- Live Ghostery filter-list download and cosmetic filtering in Electron.
- Real extension compatibility tests across third-party packages.
- Native website login-form compatibility testing across sites.
- Packaged Windows signing, installer generation, or automatic update rollout.
- Native OAuth provider connection tests (no native service connector is
  implemented).

RECOMMENDED FIRST-RUN SMOKE TEST
--------------------------------
1. Start the app and check that the browser chrome, workspaces, panels and tabs
   load without a renderer/main-process error. For V2.2-specific checks, see
   the Performance Manager checklist below and V2.2-CHANGELOG.txt.
2. Create a test browser profile, add tabs/bookmarks, restart, and verify the
   profile is restored.
3. Open Password Manager, create a vault with a strong unique master password,
   save a test credential for a site you control, lock and unlock it, then test
   encrypted export/import in a separate test profile.
4. Test a wrong master password and verify the vault remains locked.
5. Set the vault auto-lock to one minute and verify it locks after inactivity.
6. Configure the optional Ghostery dependencies, enable filters and check the
   blocker status, per-site exception, statistics and filter refresh.
7. Test site permission grants/denials, cookie removal, strict referrer policy
   and active-profile cookie clearing on exit.
8. Load a trusted unpacked extension, inspect its requested permissions, then
   enable, disable, reload and remove it.
9. Open service tiles, install a web app, and verify they open in their intended
   browser/web-app windows.
10. Configure the AI endpoint only if desired. Test page summary and multi-tab
    comparison with non-sensitive public pages.
11. Create and run a safe browser workflow. Verify that each step is visible
    and no website form is submitted automatically.
12. Export a profile backup, change some non-sensitive data, restore it, and
    verify the expected bookmarks, notes, workspaces and settings return.
13. Verify the update manifest checker opens only the HTTPS URL supplied by
    your trusted release manifest. It does not install updates automatically.

V2.1 — PERFORMANCE AND RELIABILITY
---------------------------------
- Performance Manager now samples Electron application process metrics using
  app.getAppMetrics(), and associates tab WebContents with renderer PIDs.
- Per-tab information includes renderer PID, process type, approximate memory,
  CPU usage, sleeping state, audio state, and renderer health. Chromium can
  share renderer processes, so per-tab metrics are not always exclusive to a
  single page. Values are diagnostic estimates, not a profiler.
- Tab health states include recovering, crashed, and not responding.
- A crashed page receives at most one automatic reload attempt. If that
  attempt fails or the renderer crashes again, a local recovery page appears
  with a safe retry button.
- Unresponsive and responsive renderer events are recorded in a local health
  event log. Private tab URLs are excluded from persistent diagnostics.
- Startup records an unclean-shutdown marker and displays a recovery notice
  after a later launch when the previous session did not close normally. Tabs
  are restored from the latest saved checkpoint; unsaved page state cannot be
  guaranteed.
- Settings/data JSON writes use a temporary file and rename where supported,
  with a direct-write fallback if the platform does not allow the rename.
- Diagnostics export includes browser/Electron/Chromium versions, OS details,
  process metrics, non-private tab origins, and recent health events. Inspect
  the exported file before sharing it. Page titles and website origins can
  still reveal personal browsing context.
- Safe Mode restarts the browser with --safe-mode and temporarily skips
  extension loading and the ad-blocking engine. It does not disable Chromium
  sandboxing or other browser security boundaries. Restart normally to leave
  Safe Mode.
- Health monitoring can be disabled. Manual Performance Manager refreshes
  still sample process metrics when requested.

V2.1 LIMITATIONS
----------------
- Process memory and CPU are provided by Electron/Chromium and can vary by OS.
  Shared renderer processes mean memory/CPU cannot always be attributed to a
  single tab accurately. System memory usage is machine-wide, not browser-only.
- This source bundle has not been launched in Electron Fiddle here. Run the
  included smoke tests in the target Electron runtime.
- Crash recovery cannot recover unsaved form data, media state, or arbitrary
  in-page JavaScript state. The retry loads the saved page URL again.
- Safe Mode is a troubleshooting launch mode, not a malware scanner or a
  replacement for normal operating-system security.

V2.1 — FIRST-RUN SMOKE TEST
--------------------------
1. Start the app normally. Open Performance Manager from Browser Hub or the
   Settings page and verify process and tab rows appear after the first sample.
2. Open several websites and confirm tab titles, sleeping state, and metrics
   update. Remember that multiple tabs may share a renderer process.
3. Enable/disable health monitoring and confirm the preference survives a
   restart. Use Refresh measurements to request a manual sample.
4. Confirm the automatic-recovery preference can be toggled and saved.
5. Export a diagnostics report to a chosen local file. Inspect the JSON before
   sharing it; it includes non-private origins, titles and process details.
6. Restart normally from Performance Manager and verify tabs are restored.
7. Use Restart in Safe Mode and confirm the notification appears and extensions
   and ad blocking are skipped for that run. Restart normally afterward.
8. If a renderer crash occurs during testing, verify one reload is attempted;
   if it fails again, the recovery page should offer a safe retry. Do not
   intentionally crash a production profile or test with important unsaved data.
9. Force-close only a disposable test session, relaunch, and confirm the
   unclean-shutdown recovery notice appears.
10. Close normally and verify the next launch does not show an unclean notice.

END OF README


V2.0 SETTINGS EXPERIENCE UPDATE
- The Browser Hub now opens as a full-page workspace below the browser toolbar instead of a narrow overlay sidebar. Its left navigation is grouped by browser area and includes a search field.
- The Settings window has a Brave-inspired layout with a persistent left navigation rail, settings search, focused content area, and quick links to Profiles, Password Manager, Ad Blocker, Site Permissions, Extensions, and Import/Backup in the Browser Hub.
- Browser Hub can return to normal browsing using the top-right close button. The Settings page can open a chosen Browser Hub section directly.
- The former Side panel width preference now controls the width of an active custom Web Panel.


V2.2 — ADVANCED TAB ECOSYSTEM

Tab Containers are separate Chromium sessions within the current browser profile.
Each persistent custom container receives its own Electron session partition, which
isolates cookies, local storage, IndexedDB, cache and website logins from other
containers. Container partitions are profile-specific. The Default container uses
the profile's existing main session so existing logins remain available.

Create and manage containers in Browser Hub > Tab containers. Each container can
have a custom name, icon and color. Tabs show their container identity in the tab
strip. New tabs inherit the active tab's container; duplicate tabs, popup tabs and
translation tabs also retain their source container. The container quick button and
Ctrl+K Command Center provide shortcuts to open a tab in a chosen container.

Automatic domain assignment rules can route a hostname and optionally its
subdomains into a selected container. The most specific matching rule wins. Rules
apply to typed navigation, new tabs created with a URL and user-initiated top-level
links. A manual Move to container action takes precedence for that move and reloads
the URL once in the selected destination session.

Moving a tab recreates its WebContentsView in the destination session. Its current
URL, title, workspace, tab group and pinned state are retained, but unsaved form
state, active media position and arbitrary in-page JavaScript state may be lost.
Private tabs remain in the separate Private session and cannot be moved into tab
containers.

Temporary containers use non-persistent Electron session partitions. Their cookies,
site storage and cache are discarded when the application exits. Tabs in temporary
containers are excluded from startup restore, persistent history, recently closed
tabs, diagnostics/network request logs, download history and explicitly saved named
sessions. Downloaded files themselves remain on disk. A Guest profile makes all
custom containers temporary, even when their saved container definition is marked
persistent. The Default Guest session is also disposable with the Guest profile.

Ad blocking and compatible unpacked extensions are initialized for container
sessions when the installed Electron APIs support them. Changing ad-blocking
settings refreshes active container sessions as well as the main profile session.

Known limitations:
- Site permission choices and some browser-level site preferences remain
  profile-wide, rather than independently configurable per container.
- Password vault entries are profile-wide; website cookies and local storage are
  container-isolated, but saved vault credentials are not.
- Moving a tab reloads the current URL; unsaved form input and transient page state
  cannot be transferred reliably between Chromium sessions.
- Automatic domain rules apply to typed navigation and user-initiated top-level
  links. Server redirects are not silently rerouted to another container.
- Temporary container downloads are removed from the browser's saved download
  history, but the downloaded files are not deleted from the computer.
- Temporary-container filtering statistics and diagnostics are kept out of the
  persistent browser data where the Electron request metadata identifies the source
  WebContents. Some shared Chromium process activity cannot be attributed perfectly.
- The Default container intentionally reuses the existing profile session; only
  named custom persistent containers receive separate storage partitions.
- Extension compatibility depends on Electron's supported extension APIs. Some
  extensions may behave differently outside the Default session.

V2.2 — FIRST-RUN SMOKE TEST
--------------------------
1. Back up the browser source and the Electron userData/profile folder before
   replacing files. Start the app and open Browser Hub > Tab containers.
2. Create two persistent containers, for example Personal and Work. Open the same
   website in both and verify that cookies and website logins are independent.
3. Set an automatic rule for example.com to Work. Visit example.com and a
   subdomain; verify the most-specific rule and the Include subdomains option.
4. Open a tab in Personal, then right-click it and move it to Work. Confirm that
   the tab reloads and displays Work's session rather than carrying Personal cookies.
5. Create a temporary container. Browse a site and confirm its login/storage works
   during the session. Close the app and relaunch; its tabs and site data should not
   return. Verify its URL was not added to persistent history or a named session.
6. While in a temporary container, download a test file. The file should remain on
   disk, but its download record should not be retained in persistent download history.
7. Toggle ad blocking and confirm the setting refreshes both the Default and custom
   container sessions. Test with and without the optional Ghostery dependencies.
8. Switch to a Guest profile and create a custom container. Confirm it is treated as
   temporary even if the container's saved setting is Persistent.
9. Delete a disposable custom container. Its tabs should move to Default and its
   container storage/cache should be cleared. Confirm its automatic rules disappear.
10. Open a Private tab and confirm that the context menu does not offer a move to a
    regular container. Close it and verify Private session data is discarded.
11. Create a named session while a temporary-container tab is open. Confirm that
    only persistent normal tabs are included in the saved session.

No package.json, package-lock.json, node_modules, or installation scripts are
included. Import the source files into the existing Electron Fiddle project as
described in the setup section above.
