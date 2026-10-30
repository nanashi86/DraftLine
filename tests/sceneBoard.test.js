import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beatsToFountain, beatsToMarkdown } from '../src/lib/beats.js';
import { RENAME_CATEGORIES } from '../src/lib/renameCharacter.js';

// fileURLToPath, not .pathname: on Windows .pathname is "/C:/Users/…", which Windows reads as "C:\C:\Users\…".
const root = fileURLToPath(new URL('../src/', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Scene Board (formerly Beat Board)', () => {
  const board = read('components/BeatBoard.jsx');
  it('the header says Scene Board', () => {
    assert.match(board, /<h2>Scene Board<\/h2>/);
    assert.match(board, /aria-label="Scene Board"/);
  });
  it('the subheader counts the script’s scenes: "53 scenes · drag cards by the grip to restructure"', () => {
    assert.match(board, /\{scenes\.length\} \{scenes\.length === 1 \? 'scene' : 'scenes'\} · drag cards by the grip to restructure/);
  });
  it('cards are cards: Add Card, Card headline, Delete card, No cards yet', () => {
    for (const t of ['+ Add Card', 'placeholder="Card headline"', 'aria-label="Delete card"', 'No cards yet']) assert.ok(board.includes(t), t);
  });
  it('nothing on screen says "Beat Board", "beat outline" or "Add Beat" any more', () => {
    for (const f of files(root).filter((x) => /\.(jsx|js)$/.test(x))) {
      const src = code(readFileSync(f, 'utf8'));
      assert.ok(!/Beat Board|[Bb]eat outline|Add Beat|Untitled beat|Beat headline|No beats yet/.test(src), f);
    }
    assert.ok(!/Beat Board/.test(readFileSync(new URL('../README.md', import.meta.url), 'utf8')));
  });
  it('File ▾ says "Spreadsheet Outline"; outline files say Scene Outline', () => {
    assert.match(read('lib/toolbar.js'), /label: 'Spreadsheet Outline', ext: '\.csv'/);
    const beats = [{ id: 'b', act: 0, title: '', synopsis: '', tags: [] }];
    assert.match(beatsToMarkdown(beats, 'Run!'), /^# Run! — Scene Outline/);
    assert.match(beatsToFountain(beats, 'Run!'), /## Untitled card/);
  });
  it('the view switch and rename review use the new name', () => {
    assert.match(read('App.jsx'), /title: 'Scene Board only'/);
    assert.equal(RENAME_CATEGORIES.find((c) => c.id === 'notes').label, 'Scene Board & Story Bible');
  });
});

describe('Status bar', () => {
  const app = read('App.jsx');
  const status = app.slice(app.indexOf('<footer className={statusClass}'), app.indexOf('</footer>', app.indexOf('<footer className={statusClass}')));
  it('no "beats" count any more', () => {
    assert.ok(status.length > 200, 'found the status bar');
    assert.ok(!/beats/i.test(status), 'no beats item');
  });
  it('left: save / sync · Edit · scenes · words | open middle | right: [Dialogue] [Density] · pages · paper · zoom', () => {
    const at = (s) => status.indexOf(s);
    const order = [at('<div className="status-left">'), at('status-save'), at('<LockBadge'), at('{analysis.sceneCount} scenes'), at('words</span>'),
      at('<span className="status-spacer" />'), at('<div className="status-right">'), at('<DialogueStepper'), at('<DensityStepper'),
      at('title="54 lines per page"'), at('status-canvas'), at('status-zoom')];
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), JSON.stringify(order));
    const left = status.slice(at('<div className="status-left">'), at('<span className="status-spacer" />'));
    assert.ok(!/Stepper/.test(left), 'no tool steppers on the left');
  });
  it('nothing squashes: helpers step aside (statusFit.test.js), the right never shrinks; any stepper hides the key hints', () => {
    const css = read('App.css');
    assert.match(css, /\.status-left \{[^}]*flex: 0 1 auto; min-width: 0; overflow: hidden; \}/);
    assert.match(css, /\.status-right \{[^}]*flex: none; \}/);
    assert.match(css, /\.status-spacer \{ flex: 1 1 0; min-width: 8px; \}/);
    assert.match(css, /\.status\.has-tools \.status-hints \{ display: none; \}/);
    assert.match(read('App.jsx'), /const statusClass = `status\$\{statusTools \? ` has-tools tools-\$\{Math\.min\(statusTools, 3\)\}` : ''\}`;/);
  });
});
