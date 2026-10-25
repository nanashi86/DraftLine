# FDX fixtures

Final Draft (`.fdx`) files used by `tests/fdxFixtures.test.js` to check DraftLine's import and
export against Final Draft's file structure.

## Where they come from

These files are **constructed**, not saved from a copy of Final Draft. Each one follows the structure
Final Draft 12/13 writes: the `<FinalDraft DocumentType="Script" Template="No" Version="5">` root,
`<Paragraph Type="…">` elements with `<Text>` runs and `Style="Bold+Italic"` tokens,
`Number="12A"` scene numbers with `<SceneProperties>`, `<DualDialogue>` blocks, `<ScriptNote>`s,
a `<TitlePage>`, and the settings blocks Final Draft puts around the script (`HeaderAndFooter`,
`PageLayout`, `ElementSettings`, `SmartType`, `MoresAndContinueds`, `Revisions`, `SplitState`,
`Macros` and so on).

All script text is original (a short piece called *The Last Ferry*). No copyrighted screenplay text
is included. The fixtures are well-formed XML (`xmllint --noout *.fdx` is clean, and the suite
checks this itself).

**Still worth doing:** export a few of these from a real copy of Final Draft and add the saved files
as `13-…`, `14-…`, so the suite also covers whatever Final Draft actually writes that is not
reproduced here.

## The fixtures

| File | Covers |
| --- | --- |
| `01-standard-scene.fdx` | Scene Heading, Action, Character, Parenthetical, Dialogue, Transition |
| `02-dual-dialogue.fdx` | Two `<DualDialogue>` pairs, one with a parenthetical on the right |
| `03-inline-formatting.fdx` | Bold, Italic, Underline, Strikeout, Bold+Italic, Bold+Italic+Underline, Underline+AllCaps, in Action and Dialogue |
| `04-title-page-full.fdx` | Title (with Font/Size/Style), "Written by", author, "Based on", Left-aligned contact block, Right-aligned draft and date |
| `05-scene-numbers.fdx` | Scene numbers 12, 12A, 12B, 13 with `<SceneProperties>` (as locked numbers are stored) |
| `06-script-notes.fdx` | `<ScriptNote>` on Action and Dialogue, and on an otherwise empty line |
| `07-transitions-shots.fdx` | `Shot` elements, DISSOLVE TO / SMASH CUT TO / FADE OUT., and a centered THE END |
| `08-character-extensions.fdx` | (O.S.), (V.O.), (O.C.), stacked (V.O.) (CONT'D), a curly (CONT’D), (ON RADIO) and a `#` in a name |
| `09-blank-cleanup.fdx` | Empty, whitespace-only and self-closing paragraphs, and empty cue/dialogue/parenthetical |
| `10-fd13-full-skeleton.fdx` | A full Final Draft 13-style file: arc beats in `SceneProperties`, font attributes and `RevisionID` on runs, `StartsNewPage`, `ListItems`, `TargetScriptLength` |
| `11-unicode-and-escapes.fdx` | Accents, curly quotes, em dash, ellipsis, `&amp; &lt; &gt; &quot;`, decimal and hex character references |
| `12-general-and-unknown.fdx` | `General` (DraftLine's format cue) and elements DraftLine doesn't have: New Act, End of Act, Lyrics, Cast List |

## What the suite checks

1. **Parsing fidelity:** every element comes in, in order, with the right type and its text exactly
   as written, including formatting on the right characters and the title page.
2. **Export fidelity:** DraftLine's `.fdx` is well-formed XML, checked by a strict checker in the
   test rather than the forgiving test DOM. It also has Final Draft's shape: the root and its
   attributes, one `<Content>` of `<Paragraph>`s with known types, speech only inside
   `<DualDialogue>`, and known `Style` tokens.
3. **Invariance:** FDX → DraftLine → FDX keeps element order, types, text, formatting marks,
   dual-dialogue flags and title-page fields. A second round trip produces exactly the same file.

## Known gaps

The suite pins these, so a fix shows up as a failing test to update.

- **Scene numbers:** `12A`, `12B` and locked numbers are not kept. DraftLine renumbers 1, 2, 3… on
  export.
- **ScriptNotes:** these import as DraftLine margin notes but are never written back, because
  DraftLine keeps notes private. A note-only empty line is dropped on export.
- **Shot** imports as Action and exports as Action.
- **New Act, End of Act, Lyrics, Cast List** and other element types DraftLine doesn't have
  import as Action. Their text is kept but the type is lost.
- **AllCaps** (Final Draft's display style) is not kept as formatting. The text keeps whatever
  case it was typed in.
- **Final Draft's settings** (element styles, SmartType lists, page layout, revisions, macros) are
  not carried over. DraftLine writes its own minimal file.
