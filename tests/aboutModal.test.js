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

  it('the Origin Story reads exactly as written, with the title in italics and DraftLine in bold', () => {
    const block = about.slice(about.indexOf('className="hm-origin"'), about.indexOf('</section>'));
    const story = text(block.slice(block.indexOf('<p>'))).trim();
    assert.equal(story, 'My storytelling journey began when I was eight years old, banging out short stories on my father’s '
      + 'electric typewriter and sketching character designs. I’ve always loved storytelling. Years later, when I set out '
      + 'to write my first feature-length screenplay, What Happened to Haiti?, I took the hard route. Refusing to pay '
      + 'subscriptions for bloated commercial tools, I built an industry-standard template in raw Google Docs and manually '
      + 'handled every indentation, parenthetical, and scene heading across six drafts. That grind taught me the mechanics '
      + 'of dramatic architecture from the ground up: discovering where a narrative drags, how dialogue functions as '
      + 'action, and how multiple dramatic threads intertwine across fifty-plus scenes. When preparing for my next script, '
      + 'I explored existing modern screenwriting applications. Every option either locked vital structural tools behind '
      + 'paywalls, cluttered the writing canvas, or lacked the planning features screenwriters need. So, I teamed up with '
      + 'my AI buddies and engineered DraftLine.');
    assert.match(block, /<i>What Happened to Haiti\?<\/i>/);
    assert.match(block, /<b>DraftLine<\/b>\./);
    assert.match(block, /<h3 id="hm-origin-title">Origin Story<\/h3>/);
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
