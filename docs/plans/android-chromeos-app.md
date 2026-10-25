# Android & ChromeOS App — phones, tablets and Chromebooks (future plan)

Status: **planned, not started.** Written October 2026.

DraftLine already installs as a PWA on Android and ChromeOS: `public/manifest.json` and the service worker are in
place. This plan makes it a first-class touch, keyboard and stylus app, and puts it on Google Play.

---

## A. Technical Architecture & Implementation Spec

### Goal

One DraftLine that feels native on:

- **Android phones and foldables:** touch first, with the on-screen keyboard.
- **Android tablets:** touch, or a docked or Bluetooth keyboard.
- **Chromebooks**, including Pixelbook-class devices: keyboard and trackpad first, touchscreen as a bonus.

It is the same code as the web app, with no separate mobile editor.

### Principles

- **Same app, adaptive layout.** The layout responds to the screen and the input device, not to a "mobile build".
  A Chromebook with a keyboard gets the desktop experience. A phone gets the compact one. A tablet switches between
  them when its keyboard is attached or detached.
- **Nothing on the canvas that isn't the script.** Touch controls appear only when there's no physical keyboard, and
  only while typing. They live in the keyboard's own space, not on the page.
- **Local-first stays true.** Scripts live on the device (IndexedDB) and in files the writer chooses. There are still
  no DraftLine servers.
- **Web platform first, native only where the web can't reach.** The single native piece we expect to need is
  folder sync on Android (see Storage).

### Distribution: hybrid strategy

| Channel | How | Status |
|---|---|---|
| **Install from the browser** | Chrome on Android installs the PWA as a **WebAPK**: a real app icon, its own task in Recents, and offline use | Works today |
| **Chromebooks** | Install from Chrome's address bar (it runs in its own window), or get it from Google Play once listed | Works today (browser install) |
| **Google Play** | A **Trusted Web Activity** (TWA) generated with **Bubblewrap**: a thin Android shell that opens DraftLine full-screen in Chrome, with the Chrome engine, storage and updates | Planned |

**Why TWA rather than a WebView wrapper:**

- The app runs in the user's up-to-date Chrome, so it gets the same engine, performance and Web APIs as the web app.
- App updates are web deploys, so the Play listing rarely needs a new build.
- The Android package is tiny (well under 1 MB).

**TWA requirements and gotchas:**

- **Digital Asset Links:**
  - The site must serve `/.well-known/assetlinks.json` at the **origin root**, so Chrome trusts the app and hides its
    URL bar.
  - DraftLine lives at `nanashi86.github.io/DraftLine/`, so the file must be at
    `https://nanashi86.github.io/.well-known/assetlinks.json`. That means a `nanashi86.github.io` user-site repo, or a
    custom domain. This is decided before Phase 3.
  - GitHub Pages needs a `.nojekyll` file so the dot-folder is published.
- **Signing:** Play App Signing holds the release key. Its SHA-256 fingerprint goes into `assetlinks.json`.
- **Play Console:**
  - A one-time **$25** registration fee.
  - New personal developer accounts must run a **closed test with at least 12 testers, opted in for 14 consecutive
    days**, before they can publish to production. The Discord community is the natural place to recruit testers.
- **Package id** `io.github.nanashi86.draftline` or the custom domain's equivalent. It never changes after the first
  release.

### Responsive ergonomics

Breakpoints are by layout width, not device type. Input is detected separately: whether there's a fine pointer, and
whether a hardware keyboard has been seen.

| Mode | When | Layout |
|---|---|---|
| **Compact** (phone, folded foldable) | < 600 CSS px wide | One column; drawers become **bottom sheets**; the toolbar collapses into ⋮; Scene Board becomes a reorderable list; Plan tables scroll sideways with the first column pinned |
| **Medium** (small tablet, split screen) | 600–1023 px | Page view with one drawer at a time, overlaying the page |
| **Expanded** (10"–14" tablet, Chromebook) | ≥ 1024 px | The full desktop layout, scaled by the existing zoom levels (`zoom.js`) |

#### Phone and foldable mode

- **Bottom-sheet menus:**
  - Projects, Scenes, Characters, Notes and ⋮ open as sheets from the bottom, in thumb reach.
  - Each sheet has a drag handle and swipe-to-dismiss, and keeps the existing drawer content.
- **Element selector:**
  - Tapping the current element's type label (Action, Character, …) opens a sheet of large, thumb-friendly targets
    for the seven element types.
  - Tab and Enter element flow still works, using the same `enterNextType` and `flowHints` as the keyboard.
- **Keyboard accessory row:**
  - A slim row sits directly above the on-screen keyboard: **Tab** (cycle element), **Enter** (next element),
    **Character**, **Scene Heading**, **( )** (parenthetical), **Undo** and **Note**.
  - It is positioned with the **VirtualKeyboard API** (`navigator.virtualKeyboard.overlaysContent` and its
    `geometrychange` event), falling back to `visualViewport`.
  - It is hidden whenever a hardware keyboard is in use.
- **Foldables:** the **Viewport Segments API** is used where it's supported. Unfolded with a hinge, the script goes on
  one side and the Scenes or Characters drawer on the other. Elsewhere a foldable is treated as Medium or Expanded by
  width.
- **The page:** the script stays a real screenplay page, scaled to fit the width, never reflowed. A "fit width" zoom
  is the default on phones, and pinch-zoom snaps to the existing zoom levels.

#### Tablet and Chromebook mode

- **Physical keyboards (Bluetooth, docked, built-in):**
  - The full desktop keyboard flow works: Tab/Enter element flow, Ctrl/Alt shortcuts from `shortcuts.js`, `[` / `]`
    speech stepping, and the no-mouse paths from the keyboard audit.
  - Every shortcut is checked against keys that ChromeOS and Android reserve, for example Search-key combos and
    Ctrl+W, Ctrl+N or Ctrl+T in app windows. Clashes get an alternative, the same way New Script uses Ctrl+Alt+N
    today.
- **Trackpads and mice:** hover states, right-click context menus and the existing pointer behaviour. ChromeOS
  trackpads already behave like desktop ones.
- **Dynamic scaling, 10"–14" screens:**
  - The page zooms to fit, and UI chrome scales with `rem`.
  - Touch targets are at least 44×44 px whenever the last input was touch (`pointer: coarse`), and tighten again on
    trackpad input.
- **Split screen and multitasking:**
  - Every layout survives live resizing: Android split screen, ChromeOS snapped windows and free-form windows.
  - The layout uses container queries rather than one-time width checks.
  - Drafts in progress are never lost on a resize or on the app going to the background. Saves already go to
    IndexedDB first.

### Stylus and touch

- **Scene Board on touch:**
  - The Scene Board (`BeatBoard.jsx`) uses HTML5 `draggable`, which is unreliable on touch.
  - Cards move to **Pointer Events**: long-press (~300 ms) to lift, drag with edge auto-scroll, drop to reorder.
  - Card moves go through the existing scene sync (`relinkSceneCards` / `moveCardStep`), so the script follows the
    board exactly as it does today.
  - `touch-action` is set so scrolling and dragging never fight.
- **Gesture scrubbing:**
  - Dragging along the page rail jumps through the script, showing a floating "Scene 12 · INT. FERRY — p. 34" label.
  - A two-finger swipe on the Scenes list steps scene by scene.
- **Stylus:**
  - Pen input is recognised (`pointerType === 'pen'`). Pen taps place the caret precisely, and touch is ignored while
    the pen is down (palm rejection).
  - **Future hook, margin annotations:** strokes drawn in the margin are saved as a margin note on that element,
    using the existing `note` field plus stroke data, and are never printed. Low-latency drawing would use Chrome's
    delegated ink trail (`navigator.ink`) where available. This is designed for, not built in this plan.
- **Text input:**
  - Each element is a `<textarea>`, which behaves well with Android keyboards (IME).
  - The editor already ignores Enter and Tab while a word is being composed (`isComposing`). Gboard, Samsung and
    SwiftKey are tested for Enter handling and autocorrect inside character cues. Autocapitalise and autocorrect are
    off for scene headings and cues.

### Storage and cloud sync

| Need | Android (Chrome / TWA) | ChromeOS |
|---|---|---|
| Everyday saving | IndexedDB, as today (persistent storage requested) | Same |
| Open a file from Google Drive, SD card or internal storage | `<input type="file">`, which opens Android's **Storage Access Framework** picker (Drive, SD, Downloads, other providers) | Files app picker, including Google Drive |
| Receive a file shared from another app (Drive, Gmail, Files) | **Web Share Target** in the manifest: "Share → DraftLine" with `.draftline`, `.fdx`, `.fountain` | Same, plus **File Handling** (open `.fdx` from the Files app) |
| Send a script or PDF somewhere | **Web Share** with files (`navigator.share({ files })`) to Drive, email or messaging | Same, or a normal download |
| **Folder sync** (every script kept as a file in a chosen folder, like the web app's Drive folder) | The browser has no `showDirectoryPicker` on Android, so it needs a native bridge (below) | **Works today**: Chrome on ChromeOS has the File System Access API, so `folderSync.js` can link a local or Google Drive folder. Verify the Drive mount on a real device |

**Android folder sync, the one native piece:**

- **The bridge:**
  - The TWA shell adds a small Kotlin module that uses SAF's `ACTION_OPEN_DOCUMENT_TREE` and keeps a persistable URI
    permission, so the folder is chosen once and kept.
  - It talks to the web app through **PostMessage for TWA** (Chrome 115+).
  - The web side gets a third `src/platform/` adapter (`android.js`) with the same interface as `folderSync.js`:
    list, read, write, snapshot and trash. The folder layout is identical, so the same Drive folder works across the
    phone, the Chromebook, the desktop app and the web.
- **Fallback:** if the PostMessage bridge proves too limited for file I/O, the shell switches to a Capacitor WebView
  wrapper. That gives full native access, at the cost of Chrome-managed updates. The engine is still Chromium (Android
  System WebView).
- **Without the bridge** (plain browser install), Android writers use Open, Share and Backup All, which is how
  phones work today.

### Phases

1. **Ergonomics in the web app.** It ships to everyone, with no store needed:
   - compact/medium/expanded layouts;
   - bottom sheets;
   - the element selector and keyboard accessory row;
   - Pointer Events drag on the Scene Board;
   - live-resize safety.
2. **Platform integration.** Web Share Target, Web Share, File Handling on ChromeOS, a ChromeOS shortcut audit, and
   stylus caret placement and palm rejection.
3. **Google Play.** Settle the asset-links origin, build with Bubblewrap, run the closed test (12 testers × 14 days),
   then go to production. The Play listing covers phones, tablets and Chromebooks.
4. **Android folder sync.** The SAF bridge through TWA PostMessage, and cross-device testing with one Google Drive
   folder.
5. **Stylus margin annotations.** The future hook.

### Testing

- **Unit:** layout-mode selection (width plus input heuristics), the accessory row's actions (each one maps to the
  same command as its key), and the Android folder adapter against a mocked bridge.
- **Browser e2e (Playwright):**
  - Device emulation (Pixel 8, Galaxy Tab S9, a 1366×768 Chromebook, touch on and off).
  - Bottom sheets and Scene Board long-press drag with touch events.
  - Resizing across breakpoints mid-edit, checking that no text is lost.
- **Real devices before each Play release:** one Android phone, one Android tablet with a keyboard, and one
  Chromebook. Test Gboard and a second keyboard, and ChromeOS tablet mode.

### Known limits to state honestly

- **Phones are for touch-ups, reading and notes,** not long writing sessions. A screenplay page is wide and a phone
  is small. DraftLine will make it comfortable, not magic.
- **Folder sync on Android needs the Play app** (Phase 4). A browser install can open and share files but can't keep a
  folder in sync.
- **iPhone and iPad are out of scope** for this plan. Safari's PWA support and file access are more limited. The web
  app still works there.
- **Google Play's rules** (the 12-tester closed test, review times) are outside our control and may change.

---

## B. Community & Backer Brief

Copy ready to paste. No dates are promised; update the status line as phases land.

### One-line pitch

> **DraftLine on Android & Chromebook:** scriptwriting anywhere. Move from your desktop standing desk to your tablet
> or Chromebook on the go, without missing a beat.

### Discord (#roadmap)

```md
**Roadmap: DraftLine for Android, tablets & Chromebooks**

Scriptwriting anywhere: seamlessly transition from your desktop standing desk to your tablet or Chromebook on the go.

**Built for the hardware you actually use**
- **Keyboards:** Bluetooth, docked, built-in. Plug one in and you get the full DraftLine keyboard flow: Tab/Enter elements, every shortcut, no mouse needed.
- **Trackpads:** Chromebook trackpads work just like a laptop's.
- **Touchscreens:** drag Scene Board cards with your finger, scrub through the script, and use big thumb-friendly element buttons.
- **On-screen keyboard:** a slim row with Tab, Enter, Character and Scene Heading right above your keyboard, gone the moment you connect a real one.
- **Stylus:** precise caret placement now, handwritten margin notes later.
- **Any screen:** phones, foldables, 10"–14" tablets, split screen. The page always stays a real screenplay page.

**Your files go where you go:** open scripts from Google Drive, your SD card or your device, share PDFs straight to Drive or email, and (in the Play Store version) keep a Drive folder in sync with your computer.

**Still free, still private.** No accounts, no DraftLine servers. Your scripts stay on your devices.

Status: *planned. Design done, build not started.* You can already install DraftLine from Chrome on Android and ChromeOS today: open the site, then Install app.
```

### Ko-fi goal

**Goal title:** DraftLine on Google Play: $25

**Goal description:**

> $25 is Google's one-time fee to publish on Google Play. Reaching this goal puts DraftLine in the Play Store for
> Android phones, tablets and Chromebooks: touch-friendly, keyboard-ready, and still completely free and private.
> Google also asks new apps for 12 testers over 14 days before launch, so if you've got an Android device or a
> Chromebook, come say hi in the Discord.

### Milestone summary (Discord and Ko-fi updates)

```md
**DraftLine Mobile & Chromebook: milestones**
1. **Touch & tablet layout.** Bottom-sheet menus, thumb-friendly element buttons, keyboard shortcut row, touch-drag Scene Board. *(in the web app, for everyone)*
2. **Share & open anywhere.** Share scripts in and out of DraftLine (Drive, Gmail, Files); open .fdx from the Chromebook Files app.
3. **Google Play launch.** Closed test with 12 community testers for 14 days, then public.
4. **Drive folder sync on Android.** The same folder your computer syncs to, kept up to date on your tablet.
5. **Stylus margin notes.** Write notes by hand in the margin.
```
