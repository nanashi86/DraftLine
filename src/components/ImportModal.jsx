import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ELEMENT_META } from '../lib/screenplay.js';
import { parseTextScript } from '../lib/textScriptParser.js';
import './ImportModal.css';

const PREVIEW_LIMIT = 400;
const ACCEPT = '.txt,.text,.fountain,.md,.draftline';

const LAYOUT_NOTES = {
  compact: 'One paragraph per line (Google Docs / Word paste)',
  'blank-line': 'Paragraphs separated by blank lines',
  indented: 'Indented, hard-wrapped text (PDF copy)',
  fountain: 'Fountain file with a title page',
};

function plural(n, one, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/**
 * Import a script from plain text: drop a .txt file or paste, preview how each line
 * was classified, then replace the current script (undoable) or append to it.
 */
export default function ImportModal({ initialText = '', initialName = '', currentBlockCount, onImport, onBackup, onClose }) {
  const dialogRef = useRef(null);
  const fileRef = useRef(null);
  const [text, setText] = useState(initialText);
  const [fileName, setFileName] = useState(initialName);
  const [autoDetect, setAutoDetect] = useState(true);
  const [unwrap, setUnwrap] = useState('auto');
  const [useTitle, setUseTitle] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const deferredText = useDeferredValue(text);
  const result = useMemo(
    () => parseTextScript(deferredText, { autoDetect, unwrap }),
    [deferredText, autoDetect, unwrap],
  );
  const { blocks, stats, meta } = result;
  const stale = deferredText !== text;
  const hasTitle = autoDetect && !!(meta.title || meta.author);

  const readFile = async (file) => {
    if (!file) return;
    // A .draftline backup isn't parsed as text: it restores the whole project as it was.
    if (/\.draftline$/i.test(file.name)) {
      setError('');
      setFileName(file.name);
      const result = await onBackup?.(await file.text(), file.name);
      if (result !== true) setError(typeof result === 'string' ? result : 'That .draftline file couldn’t be restored.');
      return;
    }
    if (/\.(docx?|pdf|fdx)$/i.test(file.name)) {
      setError(/\.fdx$/i.test(file.name)
        ? 'Final Draft files open directly — use Open in the toolbar.'
        : 'This reads plain text. In Word or Google Docs, use File → Download → Plain text (.txt), or copy and paste the script here.');
      return;
    }
    setError('');
    setText(await file.text());
    setFileName(file.name);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    readFile(e.dataTransfer.files?.[0]);
  };

  const submit = (mode) => {
    onImport({
      blocks,
      meta: useTitle && hasTitle ? meta : null,
      mode,
      stats,
    });
  };

  const summary = blocks.length
    ? `Found ${plural(stats.scene, 'scene')}, ${plural(stats.dialogue, 'dialogue block')}`
      + ` and ${plural(stats.characters, 'speaking character')}`
    : 'Nothing to import yet';

  return (
    <dialog
      ref={dialogRef}
      className="im-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="im-body">
        {/* ---- Input ---- */}
        <section className="im-input">
          <header>
            <h2>Import Script</h2>
            <p className="im-sub">From Google Docs, Word, a PDF or any plain text. Nothing changes until you load it.</p>
          </header>

          <div
            className={`im-drop${dragOver ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="im-drop-row">
              <span className="im-drop-icon" aria-hidden="true">⤓</span>
              <span>
                Drop a <b>.txt</b> script or a <b>.draftline</b> backup here, or{' '}
                <button type="button" className="im-link" onClick={() => fileRef.current?.click()}>choose one</button>
                {fileName && <span className="im-file"> · {fileName}</span>}
              </span>
            </div>
            <textarea
              className="im-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError('');
              }}
              placeholder={'…or paste your script here.\n\nINT. KITCHEN - NIGHT\n\nRosa stirs a pot.\n\nROSA\nYou\'re late.'}
              spellCheck={false}
              autoFocus={!initialText}
            />
            <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => readFile(e.target.files?.[0])} />
          </div>
          {error && <p className="im-error" role="alert">{error}</p>}

          <div className="im-options">
            <label className="im-toggle">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              <span className="im-switch" aria-hidden="true" />
              <span>
                <b>Auto-Detect Elements</b>
                <small>Scene headings, characters, dialogue, parentheticals, transitions. Off imports every paragraph as Action.</small>
              </span>
            </label>
            <label className="im-toggle">
              <input
                type="checkbox"
                checked={result.unwrapped}
                onChange={(e) => setUnwrap(e.target.checked)}
              />
              <span className="im-switch" aria-hidden="true" />
              <span>
                <b>Join wrapped lines</b>
                <small>
                  Rejoin lines a PDF or email broke mid-sentence.
                  {unwrap === 'auto' ? ' Set automatically.' : ''}
                </small>
              </span>
            </label>
          </div>
        </section>

        {/* ---- Preview ---- */}
        <section className={`im-preview${stale ? ' is-stale' : ''}`} aria-live="polite">
          <header className="im-summary">
            <p className="im-found">{summary}</p>
            {blocks.length > 0 && (
              <div className="im-chips">
                {['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'format_cue', 'centered'].filter((t) => !['format_cue', 'centered'].includes(t) || stats[t]).map((t) => (
                  <span key={t} className={`im-chip im-t-${t}`}>{ELEMENT_META[t].label} <b>{stats[t]}</b></span>
                ))}
              </div>
            )}
            {blocks.length > 0 && (
              <p className="im-note">
                {LAYOUT_NOTES[result.layout]}
                {result.cleaned > 0 && ` · removed ${plural(result.cleaned, 'page number / (MORE) line')}`}
                {result.actBreaks > 0 && ` · removed ${plural(result.actBreaks, 'act marker')}`}
                {stats.notes > 0 && ` · ${plural(stats.notes, 'margin note')} kept`}
              </p>
            )}
            {hasTitle && (
              <label className="im-title">
                <input type="checkbox" checked={useTitle} onChange={(e) => setUseTitle(e.target.checked)} />
                Use detected title page: <b>{meta.title || 'Untitled'}</b>{meta.author ? ` by ${meta.author}` : ''}
              </label>
            )}
          </header>

          <ol className="im-list">
            {blocks.length === 0 && <li className="im-empty">Your script will appear here, element by element.</li>}
            {blocks.slice(0, PREVIEW_LIMIT).map((b, i) => (
              <li key={i} className={`im-row im-el-${b.type}`}>
                <span className={`im-tag im-t-${b.type}`}>{ELEMENT_META[b.type].label}</span>
                <span className="im-line">
                  {b.text}{b.dual ? '  ^' : ''}
                  {b.note && <span className="im-note-chip" title={b.note}>note</span>}
                </span>
              </li>
            ))}
            {blocks.length > PREVIEW_LIMIT && (
              <li className="im-empty">…and {plural(blocks.length - PREVIEW_LIMIT, 'more element')}</li>
            )}
          </ol>

          <footer className="im-actions">
            <span className="im-hint">
              {currentBlockCount > 1 ? 'Replacing can be undone with Ctrl+Z.' : ''}
            </span>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={!blocks.length}
              onClick={() => submit('append')}
              title="Add the imported script after your current one"
            >
              Append
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!blocks.length}
              onClick={() => submit('replace')}
            >
              Load into Editor
            </button>
          </footer>
        </section>
      </div>
    </dialog>
  );
}
