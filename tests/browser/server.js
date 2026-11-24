// The Vite dev server each browser test file runs its pages against (not a test itself: the
// browser suite is tests/browser/*.browser.js).
//
// `npm run test:browser` runs the test files at the same time, each in its own process with its own
// server. Two things made that unreliable on Windows, and both are handled here:
//
//   1. One shared dependency cache. Every server used node_modules/.vite, and when that cache was out
//      of date they all rebuilt it at once. Each rebuild writes a temporary folder and renames it over
//      the cache; on Windows a rename over a folder another process is reading fails, so some servers
//      kept serving a cache that no longer matched theirs. Their pages never started (no app, no file
//      input) and every test in that file timed out. The leftover deps_temp_* folders were the trace.
//      Now each test file has a cache of its own (node_modules/.vite-browser-tests/<file>), kept between
//      runs, so nothing is shared between processes, or with `npm run dev`.
//   2. Why the cache kept going out of date: Vite keys it on the project folder's path as a string,
//      and Windows paths ignore case. Started through npm the folder was C:\Users\…\DraftLine (its real
//      name), typed at the prompt it was …\draftline, so each switch between `npm run test:browser` and
//      `node --test …` meant a rebuild. The folder is now always its real name on disk.
//
// The server is ready before the first test: the app's entry is transformed up front, which finds
// and pre-bundles its dependencies (React, Lucide…) before any page asks for them.
import { realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Start a server for the test file at `testFileUrl` (its import.meta.url). → { server, url } */
export async function startTestServer(testFileUrl) {
  const root = realpathSync.native(fileURLToPath(new URL('../..', import.meta.url)));
  const name = basename(fileURLToPath(testFileUrl)).replace(/\.browser\.js$/, '');
  const { createServer } = await import('vite');
  const server = await createServer({
    root,
    cacheDir: join(root, 'node_modules', '.vite-browser-tests', name),
    logLevel: 'silent',
    server: { port: 0, strictPort: false },
  });
  await server.listen();
  await server.transformRequest('/src/main.jsx');
  return { server, url: server.resolvedUrls.local[0] };
}
