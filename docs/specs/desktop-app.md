# Desktop App — native shell for Windows (macOS and Linux later, if ever) (future plan)

Status: **future, free for everyone. A separate distribution workstream, not a numbered roadmap stage. Not started,
not scheduled.** Written October 2026; repositioned November 2026; entitlements updated November 19, 2026. The web app
stays the flagship; a desktop app would be the same DraftLine in a native window, built from the same code.

> **Entitlement model (Option D, approved November 19, 2026).** ([`../../ROADMAP.md`](../../ROADMAP.md),
> [`pro-license.md`](pro-license.md))
> - **The Windows desktop app is free** and isn't a paid tier. **DraftLine Core is free in it**, as on every supported platform.
> - **DraftLine Pro** (a planned **one-time** purchase) is a capability purchase, not an app purchase: bought once, it
>   unlocks Shoot and production revisions in the browser, the installed app and every native app.
> - **DraftLine Co-Write** (planned) is an independent optional subscription for hosting co-writing
>   sessions, with Core or Pro. Not required for Pro, not included in it.
> - Pro and Co-Write entitlements are **portable across supported platforms**: one key each, entered in
>   **Settings → Licenses & Access**, no account. There is **no separate desktop or mobile subscription**.
> - **Supporters:** Ko-fi supporters and Patreon's **The Writers' Room** ($10) and **Executive Producer** ($25) tiers
>   get early access to the native builds once the Ko-fi goal ("DraftLine Native Desktop & Android/ChromeOS Builds")
>   is reached; those two Patreon tiers are also planned to receive DraftLine Pro and Co-Write when they launch
>   (see the ROADMAP).
> - **No release dates or store availability are promised.**
> - **To research before any build:** Microsoft Store and direct-download policies for activating a licence bought on the web
>   (non-game apps may use their own payments in the Store; confirm current rules), offline licence checks inside the
>   app, and code-signing costs (Part A).
> - **Platform scope: Windows only for now.** macOS and Linux are not planned at the moment. The research below
>   covers all three and is kept for later.
>
> **Superseded:** earlier drafts sold the desktop app itself as a paid product. Replaced by the model above; this
> update is authoritative.
>
> Part A's technical research (Tauri vs Electron, file system, windows, shortcuts, updater, signing costs, security)
> remains valid. Pro unlocking in the app uses the shared Settings → Licenses & Access check (not a download gate),
> working offline.

---

## A. Technical Architecture & Implementation Spec

### Goal

A small, fast native app for Windows, macOS and Linux that:

- works fully offline;
- has no browser around it;
- opens and saves real files through the operating system.

The editor is not rewritten: the desktop app wraps the existing Vite/React bundle.

### Principles

- **One codebase.** The editor, pagination, PDF engine, `.fdx`/Fountain import and export, Plan and Reports are all
  shared with the web build. Platform differences live behind one small adapter (`src/platform/`) and nowhere else.
- **Offline by design.** The app's files are bundled, so there is no service worker and no CDN. The only network
  request is the update check, which is visible and can be switched off (*Settings → Check for updates*).
- **Files are the ground truth.** In the browser, IndexedDB is the ground truth and folder sync is optional. On the
  desktop, every script is a `.draftline` file in a folder the writer chose, and IndexedDB is only a cache.
- **Nothing new on the canvas.** Native menus and the title bar take over existing commands. No new buttons.
- **Small.** The target is an installer under 15 MB, and launch to a usable editor in under a second on a 2020 laptop.

### Framework choice

| | **Tauri 2 (chosen)** | Electron (fallback) |
|---|---|---|
| Engine | The system webview: WebView2 (Chromium) on Windows, WKWebView on macOS, WebKitGTK on Linux | Bundled Chromium, the same on every OS |
| Installer size | ~5–15 MB | ~90–150 MB |
| Memory at idle | Low (shared system webview) | Higher (a full Chromium per app) |
| Native layer | Rust, with a capability-scoped plugin system (fs, dialog, updater, window-state) | Node.js, with full access by default (must be locked down) |
| Risk | Engine differences on macOS/Linux (WebKit) | None on rendering; cost is size and memory |

We use Tauri because it fits DraftLine's speed and minimalism. Electron stays the documented fallback if WebKitGTK on
Linux turns out to be unworkable. The only engine-sensitive pieces are pagination measurement (Courier Prime is
bundled, so line breaks match), the PDF worker and Snapshot Compare's diff worker, which are plain Web Workers, and
Table Read's speech, which is planned and not built yet.

### Project layout

```
src-tauri/
  Cargo.toml
  tauri.conf.json           # windows, bundle ids, file associations, CSP, updater endpoint
  capabilities/default.json # what the web code may call (fs scoped to chosen folders, dialog, updater…)
  src/main.rs               # plugins + single-instance + "open with" handling
src/platform/
  index.js                  # picks web or desktop at startup (isTauri())
  web.js                    # today's behaviour: IndexedDB, File System Access, downloads
  desktop.js                # native dialogs, fs, menus, window, updater
```

- **Build:** `npm run build:desktop` runs `vite build --mode desktop`, with `base: './'` instead of `/`.
  Service worker registration is skipped, and the `src/platform/desktop.js` adapter is used. Then `tauri build`
  runs.
- **Dev:** `npm run dev:desktop` runs `tauri dev` against the Vite dev server.
- **Tests:** `npm test` is unchanged. The platform adapters get their own unit tests with the native APIs mocked.

### Native file system

| Today (web) | Desktop |
|---|---|
| Open via `<input type="file">` | Native **Open** dialog (`tauri-plugin-dialog`), filtered to `.draftline`, `.fdx`, `.fountain`, `.txt`, `.docx` |
| Export downloads to the Downloads folder | Native **Save As** dialog with the right extension and a remembered folder; **Save** writes in place |
| Folder sync via `showDirectoryPicker` (asks permission each session) | The same folder model (`folderSync.js`), but writes go through `tauri-plugin-fs`, scoped to the chosen folder: no permission prompts, ever |
| No file associations | Double-clicking a `.draftline` or `.fdx` file opens it in DraftLine (bundle `fileAssociations`); single-instance, so a second file opens in the running app |

- The **library folder** defaults to `Documents/DraftLine/` on first run. The writer can change it, for example to a
  Google Drive, Dropbox or OneDrive folder, and the same `Snapshots/` and `Trash/` layout is kept, so a folder synced
  from the web app opens unchanged.
- **Opening a `.fdx`** imports it as a new script, as today. **Save** on an imported `.fdx` asks once, *Keep as
  DraftLine script* or *Save back to .fdx*, because `.fdx` export is lossy (see `tests/fixtures/fdx/README.md`, Known
  gaps).
- **Recent files** appear in *File → Open Recent* and in the OS jump list (Windows) and Dock menu (macOS).
- **Crash safety:** saves write a temp file and rename it over the original, so a power cut never leaves a
  half-written script.

### Window management

- **Title bar:**
  - Windows and Linux use a frameless window (`decorations: false`) with DraftLine's own title bar. It is the existing
    header with a `data-tauri-drag-region`, plus minimise, maximise and close buttons as Lucide icons, in the dark
    palette (`#18181b`).
  - macOS uses `titleBarStyle: "Overlay"`, so the native traffic lights sit over our header.
  - The web manifest already asks for `window-controls-overlay`, so the header layout already allows for this.
- **Window state:** size, position, maximised state and which monitor are remembered (`tauri-plugin-window-state`).
  A window that would open off-screen after a monitor is unplugged is moved back on screen.
- **Native menu bar**, built from the same lists as the web toolbar (`src/lib/toolbar.js`), so the two never drift:
  - **File:** New Script, Open…, Open Recent, Save, Save As…, Export Script (PDF · Final Draft · Fountain · Print…),
    Backup Project.
  - **Edit:** Undo, Redo, Cut, Copy, Paste, Find, Find & Replace, Select All.
  - **View:** Page · Split · Board, Zoom, Focus.
  - **Plan:** Breakdowns, Stripboard, Reports.
  - **Help:** User Guide, Keyboard Shortcuts, Support DraftLine, About.
  - macOS also gets the standard app menu (About, Settings, Hide, Quit).
- **Focus mode** can go full screen through the native full-screen API, so it is distraction-free with no browser UI
  at all.

### Keyboard shortcuts

Shortcuts the browser takes for itself stop being a problem once there's no browser:

- **Today, browser-reserved keys force workarounds.** Ctrl+N, Ctrl+T and Ctrl+W can't be overridden in a tab, which
  is why New Script is Ctrl+Alt+N. Ctrl+H and Ctrl+S work only because we call `preventDefault()` in time.
- **WebView2 still has built-in accelerators.** Ctrl+P (print), Ctrl+F (find), F5 and Ctrl+R (reload), and
  Ctrl+Shift+I (devtools) are turned off with `AreBrowserAcceleratorKeysEnabled = false` in release builds. Every
  shortcut in `src/lib/shortcuts.js` then reaches DraftLine.
- **Native menu accelerators and in-editor keys come from one table** (`shortcuts.js`), so there's no double-firing.
  Menu items carry the accelerator for display. Editor-context keys stay in the web layer: Tab and Enter element
  flow, Alt+letter drawers, and `[` / `]` speech stepping.
- **Ctrl+N becomes New Script on desktop.** Ctrl+Alt+N keeps working.
- **On macOS, Ctrl maps to Cmd** in labels and handling, as the shortcut list already does.
- **Test:** a desktop smoke test presses every combination in `shortcuts.js` and checks that the app handles it and
  the webview doesn't.

### Auto-updater

- **Plugin and source:** `tauri-plugin-updater` checks GitHub Releases (`releases/latest/download/latest.json`) at
  launch and every 24 hours, in the background.
- **Signature-verified:**
  - Every update bundle is signed in CI with the project's updater key. The public key ships inside the app.
  - An update that fails verification is discarded and never installed.
  - The private key lives only in GitHub Actions secrets.
- **Quiet:** a small toast in the existing toast zone ("DraftLine 0.12 is ready — Restart to update"). It never
  interrupts typing and never restarts on its own.
- **Opt-out:** switching off *Check for updates* means zero network traffic.
- **OS code signing** is separate from update signing:

  | OS | What's needed | Cost (Oct 2026) | Without it |
  |---|---|---|---|
  | macOS | Apple Developer Program, Developer ID certificate, notarization | $99 / year | Gatekeeper blocks the app; users must right-click → Open |
  | Windows | Azure Artifact Signing (formerly Trusted Signing), or an OV certificate from a CA | $9.99 / month (individuals: USA/Canada only), or ~$200–400 / year for a CA certificate | SmartScreen "unrecognised app" warning until reputation builds |
  | Linux | None (AppImage, `.deb`, `.rpm`; optionally Flathub) | Free | — |

- **CI:** a GitHub Actions matrix (windows-latest, macos-latest universal binary, ubuntu-22.04) builds, signs and
  uploads to a draft release on every `v*` tag. Eric publishes the release by hand.

### Security

- **Strict CSP.** No remote scripts, and `connect-src` covers only the update endpoint.
- **Tauri capabilities.** The web layer can reach only the dialog, scoped fs (the library folder plus files the
  writer picked), window, menu and updater. There is no shell access and no arbitrary paths.
- **No telemetry,** the same promise as the web app.

### Migrating from the web app

- A browser's IndexedDB can't be read by the desktop app; they are different origins.
- **First-run welcome:** two choices.
  - *Open my synced folder*: point at the folder the web app already syncs to. Nothing else is needed.
  - *Import backups*: use **Backup All** in the browser, then open the files.
- Both formats are the same `.draftline` files, so nothing is converted.

### Phases

1. **Shell.** Tauri wrapper, desktop build mode, platform adapter, native Open/Save, window state. Then internal
   builds on all three OSes.
2. **Native feel.** Menu bar, title bar, file associations, single instance, shortcut pass-through, recent files.
3. **Release.** CI matrix, updater signing, macOS notarization, Windows signing, then a public beta on GitHub
   Releases.
4. **Polish.** Jump list and Dock menu, Linux packaging (Flathub), and Table Read's native speech fallback where the
   webview has none.

### Known limits to state honestly

- **Linux (WebKitGTK)** is the weakest engine. Pagination and PDF output are identical because the font is bundled,
  but scrolling performance and Web Speech (Table Read) may be worse, or missing.
- **macOS (WKWebView)** has no File System Access API, which is fine because native dialogs replace it. The web
  build's code paths for it are simply unused there.
- **Unsigned builds** work but show OS warnings. Signing costs money every year (see the table above), which is what
  the backer milestone is for.
- **The web app is not going away.** It stays 100% free and open source, forever. The desktop app is free too, and
  never a requirement.

---

## B. Community copy

Launch and backer copy for this plan is not kept in the public repo. It will be written from the current plan
([`../../ROADMAP.md`](../../ROADMAP.md)) when the app is ready.
