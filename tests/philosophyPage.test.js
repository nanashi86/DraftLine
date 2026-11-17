// The Philosophy page (public/philosophy/): the mission, the founder's story and the five principles are
// published word for word as Eric wrote them. The story ends with his signature (the page opens with
// "Your Story. Your Rules." and "Just Write.", so the story doesn't repeat them). Change the wording here and on the page together, on purpose.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('public/philosophy/index.html');
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const between = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));

const MISSION = [
  "To give every writer the freedom to focus on their story, not their software.",
  "We make professional screenwriting accessible, intuitive, and free—removing the technical distractions, financial barriers, and unnecessary restrictions that get between a writer and the page."
];
const STORY = [
  "I wrote my first feature screenplay in Google Docs.",
  "It wasn't professional screenwriting software, but it worked. More importantly, it let me tell my story. And that experience taught me something: you don't need expensive tools to be a writer.",
  "When I started my second feature, things changed. I found myself spending more time worrying about formatting, page breaks, and technical details than I wanted to. The software was getting in the way of the writing.",
  "I looked for something better. There were plenty of options, but none offered quite the combination I wanted: professional formatting, useful creative tools, a clean writing environment, and the freedom to work without subscriptions, accounts, or unnecessary restrictions.",
  "So I built my own.",
  "DraftLine started as a solution to my own frustration. I wasn't trying to reinvent screenwriting. I just wanted software that would let me concentrate on what mattered: telling a story.",
  "But somewhere along the way, I realized I probably wasn't the only writer who felt this way.",
  "That's why DraftLine is free and open-source. That's why it doesn't require an account. That's why the interface stays out of your way, and why your scripts remain yours to manage.",
  "I believe good writing software should make the difficult parts of writing easier—not introduce new difficulties of its own.",
  "DraftLine was built for a simple reason: writers should spend their energy on their stories, not their software.",
  "— Eric Lemaire Jr."
];
const PRINCIPLES = [
  [
    "01",
    "Writing Comes First",
    "Every feature should serve the writing process. The interface should disappear when you're creating and become useful when you need it."
  ],
  [
    "02",
    "Creativity Shouldn't Have a Price of Admission",
    "Professional tools should be accessible without a subscription, account, or paywall."
  ],
  [
    "03",
    "Your Work Belongs to You",
    "Writers should control their files, storage, and workflow. Open formats and local-first design help protect that freedom."
  ],
  [
    "04",
    "Powerful Doesn't Have to Mean Complicated",
    "Give writers the tools they need without making them navigate tools they don't."
  ],
  [
    "05",
    "Respect the Writer",
    "No intrusive upselling, forced AI writing, unnecessary onboarding, or artificial barriers. Treat writers as creators, not conversion opportunities."
  ]
];

describe('the Philosophy page', () => {
  it('opens on "Just Write." with the philosophy and the product promise, and no brand-development captions', () => {
    assert.match(html, /<h1>Just Write\.<\/h1>/);
    assert.match(html, /<dt class="label">The Philosophy<\/dt>\s*<dd class="statement">Your Story\. Your Rules\.<\/dd>/);
    const promise = html.match(/<dt class="label">The Promise<\/dt>\s*<dd class="statement">([\s\S]*?)<\/dd>/)[1];
    assert.equal(text(promise), 'Fast, Distraction-Free Screenwriting.');
    assert.match(promise, /<span class="nowrap">Distraction-Free<\/span>/, 'never split at the hyphen');
    assert.doesNotMatch(html, /The Slogan|The invitation\.|The belief\.|The experience\./);
    assert.equal(html.match(/<h1[ >]/g).length, 1, 'one h1');
  });

  it('the mission, word for word', () => {
    const s = text(between('<section id="mission"', '</section>'));
    assert.ok(s.startsWith('Our Mission'), s);
    for (const line of MISSION) assert.ok(s.includes(line), line);
  });

  it("the founder's story, every paragraph word for word and in order, with its closing lines", () => {
    const prose = between('<div class="prose">', '</div>');
    const ps = [...prose.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
    assert.deepEqual(ps, STORY);
    assert.match(prose, /<p><strong>DraftLine was built for a simple reason: writers should spend their energy on their stories, not their software\.<\/strong><\/p>/);
    assert.match(prose, /<p class="signoff">— Eric Lemaire Jr\.<\/p>\s*$/, 'signed by Eric, and nothing after it');
    assert.match(html, /<h2 class="label" id="why-label">Why DraftLine Exists<\/h2>\s*<p class="sub">Built by a writer, for writers\.<\/p>/);
  });

  it('the five principles, numbered and word for word, and no others', () => {
    const items = [...between('<ol class="principles">', '</ol>').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    assert.equal(items.length, 5);
    items.forEach((li, i) => {
      const [n, title, body] = PRINCIPLES[i];
      assert.match(li, new RegExp(`<span class="num" aria-hidden="true">${n}</span>`));
      assert.equal(text(li.match(/<h3>([\s\S]*?)<\/h3>/)[1]), title);
      assert.equal(text(li.match(/<p>([\s\S]*?)<\/p>/)[1]), body);
    });
  });

  it('features/, compare/ and philosophy/ share one column width (the comparison table\'s 1040px)', () => {
    for (const f of ['public/features/index.html', 'public/compare/index.html', 'public/philosophy/index.html']) {
      assert.match(read(f), /\.wrap \{ max-width: 1072px; margin: 0 auto; padding: 0 16px; \}/, f);
    }
    assert.doesNotMatch(read('public/compare/index.html'), /translateX\(-50%\)/, 'the table no longer reaches past the text');
  });

  it('headings go in order: h1, then h2 sections, then h3 principles', () => {
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `h${levels[i - 1]} then h${levels[i]}`);
  });

  it('reached from the other public pages, the sitemap and llms.txt; indexable', () => {
    for (const f of ['public/features/index.html', 'public/compare/index.html', 'index.html']) assert.match(read(f), /href="\/philosophy\/"/, f);
    assert.match(read('public/sitemap.xml'), /<loc>https:\/\/draftlineapp\.com\/philosophy\/<\/loc>/);
    assert.match(read('public/llms.txt'), /\[Philosophy\]\(https:\/\/draftlineapp\.com\/philosophy\/\)/);
    assert.doesNotMatch(html, /noindex/i);
    assert.match(html, /<a href="\/features\/">every feature<\/a>/);
    assert.match(html, /<a href="\/compare\/">how DraftLine compares<\/a>/);
  });
});
