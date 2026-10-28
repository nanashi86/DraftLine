import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INTRO_DESCRIPTION_MAX, findIntroductions, introDescription, introGender, introMatches, introWindow, populateBiosFromIntros, populateSummary,
  preNameWords, pronounGender,
} from '../src/lib/characterIntros.js';
import { SAMPLE_SCRIPT } from '../src/lib/sampleScript.js';
import { GENDERS, newCharacter, normalizeCharacter } from '../src/lib/bible.js';
import { parseBackup, serializeBackup } from '../src/lib/backup.js';
import { bioCard } from '../src/lib/cueBio.js';
import { hasBio } from '../src/lib/biblePdfExport.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const A = (text, id = 'a') => ({ id, type: 'action', text });
const one = (text) => findIntroductions([A(text)])[0];
const bio = (name, extra = {}) => ({
  id: `c-${name}`, name, primaryRole: '', secondaryRole: 'none', relationship: '', age: '', description: '', traits: '', backstory: '', ...extra,
});
const MARJORIE = 'The tray tips, landing squarely in front of MARJORIE (30s)--warm-dark skin, in a blue and white server’s outfit, carrying a tray of glasses, who freezes.';

describe('Character introductions: age', () => {
  it('a) takes the age exactly as written', () => {
    assert.equal(one(MARJORIE).age, '30s');
    assert.equal(one('TONY (early 40s), broad-shouldered.').age, 'early 40s');
    for (const [text, age] of [
      ['NURSE (late 20s), scrubs.', 'late 20s'], ['JEAN-CLAUDE (mid-40s), wiry.', 'mid-40s'], ['ELDER (50-something), stooped.', '50-something'],
      ['FITO (10)--copper skin.', '10'], ['MANMAN (70), still.', '70'], ['GIRL (teens), sullen.', 'teens'], ['DOC (mid 50s), calm.', 'mid 50s'],
    ]) assert.equal(one(text)?.age, age, text);
  });
  it('the name is the capitals right before the parentheses', () => {
    assert.equal(one(MARJORIE).name, 'MARJORIE');
    assert.equal(one('A HORN BLASTS from the ferry. CAPTAIN AUGUSTIN (60s), weathered as the hull, leans over the rail.').name, 'CAPTAIN AUGUSTIN');
    assert.equal(one('ÉLODIE (20s), barefoot.').name, 'ÉLODIE');
  });
  it('never reads extensions, years or words in parentheses as an age', () => {
    for (const text of ['MARIE (V.O.) hums.', 'THEO (O.S.) calls out.', 'In 1986 (the coup year) everything changed.', 'MARIE (CONT’D) waits.', 'PORT-AU-PRINCE (1986).', 'Marie (30s) waits.']) {
      assert.deepEqual(findIntroductions([A(text)]), [], text);
    }
  });
  it('only Action is read, and only the first introduction of each name', () => {
    const blocks = [{ id: 'd', type: 'dialogue', text: 'MARIE (30s), a liar.' }, A('MARIE (30s), coat buttoned.', 'a1'), A('MARIE (40s), older now.', 'a2')];
    assert.deepEqual(findIntroductions(blocks).map((i) => [i.age, i.blockId]), [['30s', 'a1']]);
  });
});

describe('Character introductions: physical description', () => {
  it('b) the clause after the age, up to the clause or sentence boundary', () => {
    assert.equal(one(MARJORIE).description, 'warm-dark skin, in a blue and white server’s outfit, carrying a tray of glasses');
    assert.equal(one('TONY (early 40s), broad-shouldered, in a pressed black suit; he scans the room.').description, 'broad-shouldered, in a pressed black suit');
    assert.equal(one('FITO (10)--copper skin, bare feet--grins at the camera.').description, 'copper skin, bare feet');
    assert.equal(one('NURSE (late 20s) — tired eyes. She sighs.').description, 'tired eyes');
  });
  it('stops before a verb or clause takes over', () => {
    assert.equal(one('MARIE (30s), coat buttoned to the throat, drags a suitcase down the planks.').description, 'coat buttoned to the throat');
    assert.equal(one('CAPTAIN AUGUSTIN (60s), weathered as the hull, leans over the rail.').description, 'weathered as the hull');
  });
  it('stops at the next introduction in the same paragraph', () => {
    const [jc, nurse] = findIntroductions([A('JEAN-CLAUDE (mid-40s), wiry, and NURSE (late 20s), scrubs.')]);
    assert.equal(jc.description, 'wiry');
    assert.equal(nurse.description, 'scrubs');
  });
  it('no separator after the age means no description ("ELDER (50-something) waits.")', () => {
    assert.equal(one('ELDER (50-something) waits.').description, '');
    assert.equal(introDescription(' waits by the door.'), '');
  });
  it('is trimmed and kept short (cut back at a comma)', () => {
    const long = `--${'tall, '.repeat(30)}end.`;
    const d = introDescription(long);
    assert.ok(d.length <= INTRO_DESCRIPTION_MAX, `${d.length} characters`);
    assert.ok(!/[,\s]$/.test(d) && !/^[-,\s]/.test(d), JSON.stringify(d));
    assert.equal(introDescription(', "barefoot," .'), 'barefoot');
  });
});

describe('Populate Bio: fills blanks only', () => {
  const blocks = [A(MARJORIE, 'a1'), A('TONY (early 40s), broad-shouldered, in a pressed black suit.', 'a2')];

  it('fills empty Age / Timeline and Physical Description on existing bios', () => {
    const { list, filled, created } = populateBiosFromIntros([bio('MARJORIE')], blocks, ['MARJORIE']);
    assert.equal(list[0].age, '30s');
    assert.equal(list[0].description, 'warm-dark skin, in a blue and white server’s outfit, carrying a tray of glasses');
    assert.deepEqual(filled, [{ name: 'MARJORIE', fields: ['age', 'description'] }]);
    assert.deepEqual(created, []);
  });
  it('c) never overwrites a field that already has text', () => {
    const mine = [bio('MARJORIE', { age: '34 in 2021', description: 'My own words.' }), bio('TONY', { age: '  ', description: 'Keeps his.' })];
    const { list, filled } = populateBiosFromIntros(mine, blocks, ['MARJORIE', 'TONY']);
    assert.equal(list[0].age, '34 in 2021');
    assert.equal(list[0].description, 'My own words.');
    assert.equal(list[1].age, 'early 40s', 'a field of spaces counts as blank');
    assert.equal(list[1].description, 'Keeps his.');
    assert.deepEqual(filled, [{ name: 'TONY', fields: ['age'] }]);
    for (const k of ['id', 'name', 'primaryRole', 'traits', 'backstory']) assert.equal(list[0][k], mine[0][k], k);
  });
  it('d) running it again changes nothing (same list back, nothing reported)', () => {
    const first = populateBiosFromIntros([bio('MARJORIE')], blocks, ['MARJORIE', 'TONY']);
    const again = populateBiosFromIntros(first.list, blocks, ['MARJORIE', 'TONY']);
    assert.equal(again.list, first.list, 'the very same array: no re-render, no new undo step');
    assert.deepEqual(again.filled, []);
    assert.equal(again.list.length, 2, 'no duplicate bios');
    assert.equal(populateSummary(again), 'No new ages, genders or descriptions found in the script');
  });
  it('adds a bio for a speaking character the script introduces, in introduction order', () => {
    const { list, created } = populateBiosFromIntros([], blocks, ['TONY', 'MARJORIE', 'WAITER']);
    assert.deepEqual(created, ['MARJORIE', 'TONY'], 'script order, not speaking order');
    assert.deepEqual(list.map((c) => [c.name, c.age]), [['MARJORIE', '30s'], ['TONY', 'early 40s']]);
    assert.ok(list.every((c) => c.id && c.secondaryRole === 'none' && c.traits === ''), 'complete bios');
  });
  it('never invents bios for names that don’t speak', () => {
    assert.deepEqual(populateBiosFromIntros([], blocks, []).list, []);
  });
  it('matches a fuller introduction to the cue name', () => {
    assert.ok(introMatches('CAPTAIN AUGUSTIN', 'AUGUSTIN'));
    assert.ok(introMatches('TONY CINEUS', 'TONY'));
    assert.ok(introMatches('MARIE', 'marie (V.O.)'));
    assert.ok(!introMatches('MARIELLE', 'MARIE'));
  });
  it('the sample script fills all three of its bios', () => {
    const blocks2 = SAMPLE_SCRIPT.blocks.map(([type, text], i) => ({ id: `b${i}`, type, text }));
    const { list } = populateBiosFromIntros([], blocks2, ['MARIE', 'THEO', 'AUGUSTIN']);
    assert.deepEqual(list.map((c) => [c.name, c.age, c.description]), [
      ['MARIE', '30s', 'coat buttoned to the throat'],
      ['THEO', '20s', 'her brother'],
      ['AUGUSTIN', '60s', 'weathered as the hull'],
    ]);
  });
  it('reports what it did, and which fields', () => {
    const f = (...fields) => ({ fields });
    assert.equal(populateSummary({ filled: [f('gender'), f('age')], created: [] }), 'Filled 2 bios (age and gender)');
    assert.equal(populateSummary({ filled: [f('age', 'description'), f('age', 'gender', 'description'), f('age')], created: ['A', 'B', 'C'] }), 'Added 3 bios (age, gender and description)');
    assert.equal(populateSummary({ filled: [f('description'), f('description'), f('age')], created: ['A'] }), 'Filled 2 bios and added 1 (age and description)');
    assert.equal(populateSummary({ filled: [f('gender')], created: [] }), 'Filled 1 bio (gender)');
  });
});

const REPORTER = 'NEWS REPORTER (40s)--fills the frame. She\'s a striking woman in a red blazer.';
const TONY = 'TONY (early 40s), broad-shouldered, in a pressed black suit; he scans the room.';

describe('Character introductions: gender', () => {
  it('b) female signals in the introduction → Female', () => {
    const it0 = one(REPORTER);
    assert.deepEqual([it0.name, it0.age, it0.gender], ['NEWS REPORTER', '40s', 'Female']);
    assert.equal(one('WAITRESS (20s), tired.').gender, 'Female', 'the name itself counts');
    assert.equal(one('NADINE (50s)--her mother’s eyes.').gender, 'Female');
  });
  it('c) male signals → Male', () => {
    const it0 = one(TONY);
    assert.deepEqual([it0.name, it0.age, it0.gender], ['TONY', 'early 40s', 'Male']);
    assert.equal(one('OLD MAN (80s), still as a post.').gender, 'Male');
  });
  it('conflicting or missing signals leave it blank', () => {
    assert.equal(one('KIM (30s), wiry. His jacket, her bag.').gender, '', 'one "his", one "her": a tie');
    assert.equal(one('MARIE (30s), coat buttoned to the throat.').gender, '', 'nothing to go on');
    assert.equal(one('DEE (30s), in a hoodie. They tap their phone.').gender, '', 'they / their alone never decide it');
  });
  it('only reads the introduction: the name to the end of the next sentence, before anyone else is introduced', () => {
    assert.equal(one('MARIE (30s), coat buttoned. The ferry waits. Later he arrives.').gender, '', 'a third sentence is too far');
    const [a, b] = findIntroductions([A('ANA (30s), calm, and LUIS (40s), restless; he paces.')]);
    assert.equal(a.gender, '', 'Luis’s "he" isn’t Ana’s');
    assert.equal(b.gender, 'Male');
    assert.equal(pronounGender('His jacket. Her bag.'), '');
    assert.equal(introWindow('X (30s) one. two. three.', 0, 7), 'X (30s) one. two.');
  });
  it('a verb right after the age is action, not a description', () => {
    assert.equal(one(REPORTER).description, '');
    assert.equal(one('BO (30s)--stares at the door.').description, '');
    assert.equal(one('JO (20s)--freckles across her nose.').description, 'freckles across her nose', 'a plural noun stays');
  });
});

describe('Character introductions: gender, most direct evidence first', () => {
  const SANDRA = 'SANDRA (late-40s)--petite, amber-skinned woman with grey streaks in her hair, meets Fito, clutching a clipboard. Her glasses slide down her nose as she looks up at him.';
  it('a) a word before the name: "her female FRIEND (45)" is Female', () => {
    const it0 = one('Cassandre and her female FRIEND (45) lounge under the pergola');
    assert.deepEqual([it0.name, it0.age, it0.gender], ['FRIEND', '45', 'Female']);
    assert.equal(one('A young man, TONY (40s), waits.').gender, 'Male');
    assert.equal(one('A woman watches TONY (40s) cross the street.').gender, '', 'not "a woman … TONY": the woman is someone else');
  });
  it('b) the description names them: "petite, amber-skinned woman" beats a trailing "at him"', () => {
    const it0 = one(SANDRA);
    assert.deepEqual([it0.age, it0.gender], ['late-40s', 'Female']);
    assert.equal(one('JEAN (60s)--a stooped man in a cardigan; she hands him tea.').gender, 'Male', 'the noun wins over a later "she"');
  });
  it('a family word as the opening appositive names them: "THEO (20s), her brother" is Male', () => {
    assert.equal(one('Behind her, THEO (20s), her brother, jogs to catch up.').gender, 'Male');
    assert.equal(one('NADINE (50s), his mother, waits.').gender, 'Female');
    assert.equal(one('MARIE (30s), her mother’s eyes. She waits.').gender, 'Female', '"mother’s eyes" is about the mother; "She" settles it');
  });
  it('a verb after the age means no description, so pronouns decide: "--meets a woman" is not hers', () => {
    assert.equal(one('TONY (40s)--meets a woman at the bar. He orders.').gender, 'Male');
  });
  it('pronouns: the subject dominates; an object after a preposition is someone else', () => {
    assert.equal(pronounGender('Her glasses slide down her nose as she looks up at him.'), 'Female', '4 to 0: "at him" is the other character');
    assert.equal(pronounGender('She laughs. She turns to him. His face falls.'), 'Female', '4 to 1');
    assert.equal(pronounGender('She laughs. He laughs.'), '', 'even: left to you');
    assert.equal(pronounGender('They wait. Their phones buzz.'), '', 'they / their never decide');
    assert.equal(pronounGender('He hands it to her.'), 'Male', '"to her" at the end is an object');
    assert.equal(pronounGender('He reaches for her hand.'), '', '"her hand" is possessive: 2 to 1, not dominant');
  });
  it('the words before a name stop where someone else comes in', () => {
    assert.equal(preNameWords('Cassandre and her female FRIEND', 'Cassandre and her female '.length), 'her female');
    assert.equal(preNameWords('Behind her, THEO', 'Behind her, '.length), '');
    assert.equal(preNameWords('The room is quiet. A young man, TONY', 'The room is quiet. A young man, '.length), 'A young man,');
    assert.equal(introGender({ before: 'her female', name: 'FRIEND' }), 'Female');
  });
});

describe('Populate Bio: gender', () => {
  const blocks = [A(REPORTER, 'a1'), A(TONY, 'a2')];
  it('fills an empty Gender, and new bios get one', () => {
    const { list, filled } = populateBiosFromIntros([bio('TONY')], blocks, ['TONY', 'NEWS REPORTER']);
    assert.equal(list.find((c) => c.name === 'TONY').gender, 'Male');
    assert.equal(list.find((c) => c.name === 'NEWS REPORTER').gender, 'Female');
    assert.deepEqual(filled.map((f) => [f.name, f.fields]), [['TONY', ['age', 'gender', 'description']], ['NEWS REPORTER', ['age', 'gender']]]);
  });
  it('d) never changes a Gender you picked, and re-running changes nothing', () => {
    for (const mine of ['Non-Binary', 'Female', 'Other']) {
      const { list } = populateBiosFromIntros([bio('TONY', { gender: mine })], blocks, ['TONY']);
      assert.equal(list[0].gender, mine);
    }
    const first = populateBiosFromIntros([bio('TONY')], blocks, ['TONY']);
    const again = populateBiosFromIntros(first.list, blocks, ['TONY']);
    assert.equal(again.list, first.list);
    assert.deepEqual(again.filled, []);
  });
});

describe('Bios: the Gender field', () => {
  const drawer = read('src/components/CharactersDrawer.jsx');
  const css = read('src/components/ProjectBibleDrawer.css');
  it('a) stored on every bio: blank by default, one of the four values, kept through a backup', () => {
    assert.deepEqual(GENDERS, ['Male', 'Female', 'Non-Binary', 'Other']);
    assert.equal(newCharacter({ name: 'X' }).gender, '');
    assert.equal(normalizeCharacter({ id: 'a', name: 'X', gender: 'Female' }).gender, 'Female');
    assert.equal(normalizeCharacter({ id: 'a', name: 'X', gender: 'female' }).gender, '', 'only the listed values');
    assert.equal(normalizeCharacter({ id: 'a', name: 'X' }).gender, '', 'older bios load without one');
    const rec = { id: 'p', title: 'T', script: [{ id: 'b1', type: 'scene', text: 'INT. FERRY - NIGHT' }], characters: [newCharacter({ name: 'TONY', gender: 'Male' })] };
    assert.equal(parseBackup(serializeBackup(rec)).record.characters[0].gender, 'Male');
  });
  it('a) Age / Timeline and Gender share a row, like the role pickers', () => {
    assert.match(drawer, /<div className="pb-roles pb-age-gender">/);
    assert.match(drawer, /\{f\.key === 'age' \? <AgeGender c=\{c\} field=\{f\} onChange=\{onChange\} \/> : \(/);
    assert.match(drawer, /<select value=\{c\.gender \|\| ''\} onChange=\{\(e\) => onChange\(\{ gender: e\.target\.value \}\)\} aria-label="Gender">\s*<option value="">Not set<\/option>\s*\{GENDERS\.map/);
    assert.match(css, /\.pb-roles \{ display: grid; grid-template-columns: 1fr 1fr;/);
  });
  it('shows on the cue hover card and in the Story Bible PDF', () => {
    assert.match(bioCard({ id: 'a', name: 'TONY', age: '40s', gender: 'Male' }).meta, /40s · Male/);
    assert.ok(hasBio({ name: 'TONY', gender: 'Male' }), 'a gender alone is worth a page');
  });
});

describe('Populate Bio: the button', () => {
  const drawer = read('src/components/CharactersDrawer.jsx');
  const app = read('src/App.jsx');
  it('sits in the Characters header, left of expand / close, on the Bios tab only', () => {
    assert.match(drawer, /<div className="pb-head-actions">\s*\{\/\*[^*]*\*\/\}\s*\{onPopulateBios && tab !== 'dialogue' && \(/);
    assert.ok(drawer.indexOf('Populate Bio') < drawer.indexOf('<ExpandToggle'), 'before the expand button');
    assert.match(drawer, /<UserRoundPen size=\{13\} strokeWidth=\{1\.75\} aria-hidden \/>Populate Bio/);
  });
  it('reports the result, with Undo only when something changed', () => {
    assert.match(drawer, /setUndo\(\{ message: populateSummary\(r\), restore: r\.filled\.length \? \(\) => onCharactersChange\(prev\) : null \}\)/);
    assert.match(drawer, /\{undo\.restore && \(/);
  });
  it('the app runs it on the current script and only saves when something was filled', () => {
    assert.match(app, /const r = populateBiosFromIntros\(characters, blocks, speakers\);\s*if \(r\.filled\.length\) setCharacters\(r\.list\);\s*return r;/);
  });
});
