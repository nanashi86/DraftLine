import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('../src/components/HelpModal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/HelpModal.css', import.meta.url), 'utf8');
const about = jsx.slice(jsx.indexOf('className="hm-about"'));
const text = (src) => src.replace(/<\/?[a-z][^>]*>/g, '').replace(/\s+/g, ' ');

describe('About DraftLine', () => {
  it('keeps the order: title & version · description · Origin Story · Backup · storage facts · privacy note', () => {
    const at = (needle) => {
      const i = about.indexOf(needle);
      assert.ok(i >= 0, needle);
      return i;
    };
    const order = [
      at('className="hm-name"'), at('className="hm-version"'), at('A fast, distraction-free screenwriting app'),
      at('className="hm-origin"'), at('Backup Project (.draftline)'), at('<dt>Storage</dt>'), at('<dt>Last saved</dt>'),
      at('<dt>This script</dt>'), at('<dt>Protected</dt>'), at('Everything runs locally'),
    ];
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `item ${i} out of order`);
  });

  it('the Origin Story reads exactly as written', () => {
    const block = about.slice(about.indexOf('className="hm-origin"'), about.indexOf('</section>'));
    const story = text(block.slice(block.indexOf('<p>'))).trim();
    assert.equal(story, 'I began storytelling at eight on my father’s electric typewriter. Decades later, while writing '
      + 'my first feature, What Happened to Haiti?, I refused to pay bloated subscriptions and manually drafted all six '
      + 'drafts in raw Google Docs. That grind taught me structure and what features writers actually need. So I teamed '
      + 'up with my AI buddies to build DraftLine: an independent, distraction-free tool with dramatic architecture '
      + 'built right in.');
    assert.match(block, /<h3 id="hm-origin-title">Origin Story<\/h3>/);
  });

  it('the facts list leads with "Created by: Eric Lemaire Jr.", then the five storage rows, all one label width', () => {
    const facts = about.slice(about.indexOf('className="hm-facts"'), about.indexOf('</dl>'));
    const labels = [...facts.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Created by', 'Storage', 'Last saved', 'This script', 'Protected', 'Network']);
    assert.match(facts, /<dt>Created by<\/dt><dd>Eric Lemaire Jr\.<\/dd>/);
    assert.match(css, /\.hm-facts dt \{ flex: none; width: 92px;/);
    assert.ok(about.indexOf('className="hm-facts"') > about.indexOf('Backup Project (.draftline)'), 'below the backup box');
  });

  it('the story has comfortable line height and the About pane scrolls inside the dialog', () => {
    assert.match(css, /\.hm-origin p \{[^}]*line-height: 1\.7/);
    const pane = css.match(/^\.hm-about \{[^}]*\}/m)[0];
    assert.match(pane, /overflow: auto/);
    assert.match(pane, /min-height: 0/, 'can shrink in the flex dialog, so it scrolls instead of overflowing');
    assert.match(css, /\.hm-modal \{[^}]*max-height: min\(760px, calc\(100dvh - 32px\)\)/);
    // The dialog must not share the pane's class, or the whole dialog (header included) scrolls instead.
    assert.match(jsx, /className=\{`hm-modal is-\$\{kind\}`\}/);
    assert.match(css, /\.hm-modal\.is-about \{ width/);
  });
});
