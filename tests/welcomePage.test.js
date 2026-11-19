// /welcome/: a short public introduction to DraftLine Core, with a real screenshot of the editor. The
// root URL still opens the editor straight away; nobody is ever sent here automatically.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('public/welcome/index.html');
const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** Width and height of a WebP file (VP8, VP8L or VP8X). */
function webpSize(buf) {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)];
  }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
}

describe('The Welcome page', () => {
  it('opens with the slogan, Just Write., the promise and the approved introduction', () => {
    assert.match(text, /DraftLine No subscriptions\. No distractions\. No compromises\. Just Write\. Fast, distraction-free screenwriting\./);
    assert.match(text, /Professional screenplay formatting, creative planning tools, and an uncluttered writing space\. Free, open-source, and ready when you are\./);
  });
  it('Start Writing goes to the editor; Explore Features to /features/', () => {
    assert.match(html, /<a class="cta cta-lg" data-open-app href="\/\?from=welcome">Start Writing<\/a>\s*<a class="link-arrow" href="\/features\/">Explore Features →<\/a>/);
  });
  it('keeps the slogan, the philosophy and the promise as three distinct things', () => {
    assert.match(text, /The Slogan No subscriptions\. No distractions\. No compromises\. Just Write\./);
    assert.match(text, /The Philosophy Your Story\. Your Rules\./);
    assert.match(text, /The Promise Fast, Distraction-Free Screenwriting\./);
  });
  it('links to Our Philosophy, Explore Features and Compare DraftLine', () => {
    for (const [href, label] of [['/philosophy/', 'Our Philosophy'], ['/features/', 'Explore Features'], ['/compare/', 'Compare DraftLine']]) {
      assert.match(html, new RegExp(`<a href="${href}"><strong>${label}</strong>`), label);
    }
  });
  it('is about DraftLine Core: nothing unreleased or paid is advertised', () => {
    assert.doesNotMatch(text, /Table Read|Schedul|Budget|Shoot\b|Co-Write|DraftLine Pro|subscribe|sign in|log in/i);
  });
  it('the hero image is the real editor: two captured screenshots, 2880×1800, shown at their own proportions', () => {
    for (const t of ['dark', 'light']) {
      const buf = readFileSync(new URL(`../public/welcome/editor-${t}.webp`, import.meta.url));
      assert.deepEqual(webpSize(buf), [2880, 1800], t);
      assert.ok(statSync(new URL(`../public/welcome/editor-${t}.webp`, import.meta.url)).size < 300 * 1024, `${t} under 300 KB`);
    }
    assert.match(html, /<img id="editor-shot" class="screen" width="2880" height="1800"/);
    assert.match(html, /data-dark="\/welcome\/editor-dark\.webp" data-light="\/welcome\/editor-light\.webp"/);
    assert.match(html, /\.screen \{ display: block; width: 100%; height: auto; aspect-ratio: 16 \/ 10;/);
    assert.match(html, /The Last Ferry/);
    assert.deepEqual(readdirSync(new URL('../public/welcome/', import.meta.url)).sort(), ['editor-dark.webp', 'editor-light.webp', 'index.html']);
  });
  it('the screenshot follows the theme, like the page', () => {
    assert.match(html, /if \(shot\) shot\.src = light \? shot\.getAttribute\('data-light'\) : shot\.getAttribute\('data-dark'\);/);
    assert.match(html, /<noscript><img class="screen" src="\/welcome\/editor-dark\.webp"/);
  });
  it('nobody is sent here: the root still opens the editor, with no welcome redirect anywhere', () => {
    assert.match(read('index.html'), /<body>\s*<div id="root"><\/div>/);
    for (const f of ['src/App.jsx', 'src/main.jsx', 'index.html']) {
      assert.doesNotMatch(read(f), /location\.(replace|assign)\([^)]*welcome|location\.href\s*=\s*[^;]*welcome/, f);
    }
  });
});
