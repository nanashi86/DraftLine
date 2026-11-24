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
  it('opens with Welcome to DraftLine, the promise and the two approved paragraphs', () => {
    assert.match(html, /<div class="hero">\s*<h1>Welcome to DraftLine<\/h1>\s*<p class="promise">/);
    assert.match(text, /Welcome to DraftLine Fast, distraction-free screenwriting\. Our mission is to give every writer the freedom to focus on their story, not their software\. DraftLine brings together professional screenplay formatting, creative planning tools, and an uncluttered writing space\. Free, open-source, and built to keep the focus where it belongs: on your story\. Explore Features →/);
    assert.equal((html.match(/<p class="lede">/g) || []).length, 2, 'two paragraphs');
    assert.doesNotMatch(html, /eyebrow|class="kicker"/, 'no eyebrow or slogan line in the hero');
  });
  it('the hero links to Explore Features only; Open DraftLine (footer) goes to the editor', () => {
    assert.match(html, /<p class="actions">\s*<a class="link-arrow" href="\/features\/">Explore Features →<\/a>\s*<\/p>/);
    assert.match(html, /<p class="next"><a class="cta" data-open-app href="\/\?from=welcome">Open DraftLine<\/a><\/p>/);
    assert.doesNotMatch(html, />Start Writing</);
  });
  it('keeps the slogan, the philosophy and the promise as three distinct things', () => {
    assert.match(text, /The Slogan No subscriptions\. No distractions\. No compromises\. Just Write\./);
    assert.match(text, /The Philosophy Your Story\. Your Rules\./);
    assert.match(text, /The Promise Fast, Distraction-Free Screenwriting\./);
    assert.match(html, /<span class="slogan-end">Just Write\.<\/span><\/dd>/);
    assert.match(html, /\.slogan-end \{ display: block;/);
  });
  it('links to Core Philosophy, Explore Features and Compare DraftLine', () => {
    for (const [href, label] of [['/philosophy/', 'Core Philosophy'], ['/features/', 'Explore Features'], ['/compare/', 'Compare DraftLine']]) {
      assert.match(html, new RegExp(`<a href="${href}"><strong>${label}</strong>`), label);
    }
  });
  it('Everything you need to write: the four blocks, in the approved wording', () => {
    assert.match(html, /<h2 class="title" id="inside-title">Everything you need to write<\/h2>/);
    for (const line of [
      "Tab and Enter guide you through screenplay elements. Hollywood pagination handles dialogue splits with (MORE) and (CONT'D), with page counts that match your PDF.",
      'Organize your story with a Scene Board of index cards structured across three or four acts. A Story Bible and character bios, beside the script whenever you want them.',
      'Refine your script with Format Doctor and Dialogue Tuner. Compare snapshots, organize scene breakdowns, schedule shooting days on the stripboard, and run reports.',
      'No account required. Write offline on your computer or phone. Import and export Final Draft (.fdx) and Fountain files, create PDFs, and keep control of your scripts.',
    ]) assert.ok(html.includes(`<p>${line}</p>`), line);
  });
  it('is about DraftLine Core: nothing unreleased or paid is advertised', () => {
    // Scheduling has shipped (Plan → Stripboard): it may be named; Budget and the rest haven't.
    assert.doesNotMatch(text, /Table Read|Budget|Shoot\b|Co-Write|DraftLine Pro|subscribe|sign in|log in/i);
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
