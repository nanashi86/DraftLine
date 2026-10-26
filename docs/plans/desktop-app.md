# Desktop App — native shell for Windows, macOS and Linux (future plan)

Status: **planned, not started.** Written October 2026. The web app stays the product; the desktop app is the same
DraftLine in a native window, built from the same code.

Licensing: the browser version (the installable PWA) is **100% free and open source (MIT), forever**. The native
desktop build, **DraftLine Pro** (Tauri 2), carries a **perpetual one-time licence ($49)**, or is included while you're
an active Patreon supporter. That pays for the code-signing certificates (Apple $99 a year, Windows $120–$400 a year)
and the ongoing maintenance a signed desktop app needs.

Revision tracking (colour-coded revision rounds) and locked pages belong to **Phase 4: Production & Script
Supervision Tools**, for shooting scripts (design: `docs/plans/revision-mode.md`). They are production tools, not
part of the core writing and story planning tools, which stay free in the browser.

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

- **Build:** `npm run build:desktop` runs `vite build --mode desktop`, with `base: './'` instead of `/DraftLine/`.
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
- **The web app is not going away.** It stays 100% free and open source, forever. DraftLine Pro is an option, never a
  requirement: a one-time $49 licence (or included with an active Patreon supporter tier) for the native build.

---

## B. Community & Backer Brief

Copy ready to paste. No dates are promised; update the status line as phases land.

### One-line pitch

> **DraftLine Pro (desktop):** zero browser sandboxing, native desktop stability, true file ownership, and distraction-free
> writing. Windows, macOS and Linux.

### Discord (#roadmap)

```md
**Roadmap: DraftLine Pro (desktop)**

The same DraftLine you write in today, as a real app for your computer.

**What you get**
- **No browser.** No tabs, no permission prompts, no shortcuts fighting Chrome. Ctrl+N, Ctrl+H, Ctrl+S, Ctrl+P all just work.
- **True file ownership.** Your scripts are `.draftline` files in a folder you choose. Double-click a `.draftline` or `.fdx` file and it opens in DraftLine.
- **100% offline.** Everything is on your machine. The only thing it ever checks is whether there's an update, and you can switch that off.
- **Native stability.** Its own window that remembers its size and place, a proper menu bar, and full-screen Focus mode.
- **Tiny and fast.** A small download, not a 150 MB browser in disguise.

**Platforms:** Windows 11 / 10 · macOS (Apple Silicon and Intel) · Linux (AppImage, .deb, .rpm)

**The browser version stays 100% free and open source, forever.** DraftLine Pro is the native build: a one-time $49 licence (no subscription, updates included), or included while you're an active Patreon supporter. That covers the code-signing certificates and upkeep a trusted desktop app needs.

Status: *planned. Design done, build not started.* Follow along here.
```

### Ko-fi goal

**Goal title:** DraftLine Desktop: $99

**Goal description:**

> $99 is what Apple charges each year to sign and notarize a Mac app, so it opens without a "can't be verified"
> warning. Reaching this goal lets DraftLine Pro, the desktop app, ship properly signed on macOS, alongside Windows
> and Linux: the DraftLine you know, as a native app, offline, no browser, your files in your own folders. The browser
> version stays free forever. Every coffee counts. Thank you.

### Patreon post

**Title:** What's next: DraftLine Desktop

> DraftLine started as a web app so anyone could write with nothing to install. The next big step is a real desktop
> app, and here's the plan.
>
> **Same DraftLine, no browser.** The desktop app wraps the editor you already know: same pages, same shortcuts, same
> PDF. It doesn't run inside Chrome or Safari. That means no permission prompts when you save, no browser shortcuts
> getting in the way, and nothing between you and the page.
>
> **Your files, your folders.** Scripts live as `.draftline` files wherever you keep them: Documents, Google Drive,
> Dropbox. Open a Final Draft `.fdx` with a double-click.
>
> **Offline, always.** It never needs the internet. It checks quietly for updates, every update is verified before it
> installs, and you can turn the check off.
>
> **Windows 11/10, macOS (Apple Silicon and Intel) and Linux.**
>
> Your support covers the unglamorous parts that make an app trustworthy: code-signing certificates for Windows and
> macOS, so your computer knows the app is really from DraftLine. Patrons will be the first to hear when beta builds
> are ready to test.
>
> **How it's priced:** the browser version stays 100% free and open source, forever. DraftLine Pro, the desktop app,
> will be a one-time $49 licence (no subscription, updates included), or included for as long as you're an active
> Patreon supporter.
