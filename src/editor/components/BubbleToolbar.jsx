import { useCallback, useState } from 'react';
import { BubbleMenu } from '@tiptap/react';
import { useNavigate } from 'react-router-dom';
import ColorPicker from '../../components/ColorPicker';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Code, Sigma, Link, Palette, CaseSensitive,
  MessageSquarePlus, Eraser, Subscript, Superscript, Check, X,
} from '../../components/icons';
import { useApp } from '../../store/useApp';
import { annotateSelection } from '../actions';
import { cssId } from '../../lib/utils';
import { looksLikeUrl, noteHref, parseNoteHref, noteTitle } from '../../lib/links';
import { PageResults, usePageSearch } from '../../components/PagePicker';

const keep = (e) => e.preventDefault();

function Btn({ active, onClick, title, children, disabled }) {
  return (
    <button type="button" className={`hm-bbtn ${active ? 'is-active' : ''}`} title={title} onMouseDown={keep} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default function BubbleToolbar({ editor }) {
  const [panel, setPanel] = useState(null);
  const [href, setHref] = useState('');
  const [active, setActive] = useState(0);
  const presets = useApp((s) => s.settings.colorPresets);
  const customStyles = useApp((s) => s.settings.customStyles);
  const navigate = useNavigate();

  const shouldShow = useCallback(({ editor: ed, state }) => {
    const { selection } = state;
    if (!ed.isEditable || selection.empty) return false;
    if (selection.node) return false; // node selections (images, math…)
    if ('$anchorCell' in selection) return false; // table cell selection → table toolbar
    if (ed.isActive('codeBlock')) return false;
    return true;
  }, []);

  const toggle = (p) => setPanel((cur) => (cur === p ? null : p));
  const ts = editor.getAttributes('textStyle');
  const chain = () => editor.chain().focus();

  const openLink = () => {
    const cur = editor.getAttributes('link').href || '';
    const internal = parseNoteHref(cur);
    // An existing page link opens as its title so the box doubles as a page search.
    setHref(internal ? noteTitle(internal.id) || cur : cur);
    setActive(0);
    toggle('link');
  };
  // Typing a title (anything that isn't URL-like) searches pages; URLs are applied as-is.
  const searching = panel === 'link' && !looksLikeUrl(href);
  const pageResults = usePageSearch(searching ? href : '', null);
  const applyHref = (target) => {
    const internal = parseNoteHref(target);
    chain().extendMarkRange('link').setLink({ href: internal ? internal.href : target, target: internal ? null : '_blank' }).run();
    setPanel(null);
  };
  const applyLink = () => {
    const v = href.trim();
    if (!v) chain().extendMarkRange('link').unsetLink().run();
    else if (searching) {
      // A title with no match does nothing (the list says "No pages match") rather than creating https://<title>.
      if (pageResults[active]) applyHref(noteHref(pageResults[active].id));
      return undefined;
    } else chain().extendMarkRange('link').setLink({ href: /^[a-z]+:|^\/|^#/i.test(v) ? v : `https://${v}` }).run();
    setPanel(null);
    return undefined;
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="hmBubbleMenu"
      shouldShow={shouldShow}
      updateDelay={120}
      tippyOptions={{ duration: 120, maxWidth: 'none', placement: 'top-start', zIndex: 60, onHidden: () => setPanel(null) }}
      className="hm-bubble"
    >
      <div className="hm-bubble-row">
        <Btn title="Bold (Ctrl/⌘+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold size={15} /></Btn>
        <Btn title="Italic (Ctrl/⌘+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic size={15} /></Btn>
        <Btn title="Underline (Ctrl/⌘+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon size={15} /></Btn>
        <Btn title="Strikethrough (Ctrl/⌘+Shift+S)" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough size={15} /></Btn>
        <span className="hm-bsep" />
        <Btn title="Inline code (Ctrl/⌘+E)" active={editor.isActive('code')} onClick={() => chain().toggleCode().run()}><Code size={15} /></Btn>
        <Btn title="Inline math (Ctrl/⌘+Shift+M)" onClick={() => chain().toggleInlineMath().run()}><Sigma size={15} /></Btn>
        <Btn title="Subscript (Ctrl/⌘+,)" active={editor.isActive('subscript')} onClick={() => chain().toggleSubscript().run()}><Subscript size={15} /></Btn>
        <Btn title="Superscript (Ctrl/⌘+.)" active={editor.isActive('superscript')} onClick={() => chain().toggleSuperscript().run()}><Superscript size={15} /></Btn>
        <span className="hm-bsep" />
        <Btn title="Link" active={editor.isActive('link') || panel === 'link'} onClick={openLink}><Link size={15} /></Btn>
        <Btn title="Text & background color" active={panel === 'color'} onClick={() => toggle('color')}>
          <span className="hm-bcolor" style={{ color: ts.color || undefined, background: ts.backgroundColor ? `color-mix(in srgb, ${ts.backgroundColor} 30%, transparent)` : undefined }}>A</span>
        </Btn>
        <Btn title="Custom text style" active={panel === 'style' || !!ts.styleId} onClick={() => toggle('style')}><CaseSensitive size={16} /></Btn>
        <span className="hm-bsep" />
        <Btn title="Annotate selection" onClick={() => annotateSelection(editor)}><MessageSquarePlus size={15} /></Btn>
        <Btn title="Clear formatting" onClick={() => chain().unsetAllMarks().run()}><Eraser size={15} /></Btn>
      </div>

      {panel === 'color' && (
        <div className="hm-bubble-panel">
          <ColorPicker
            label="Text color"
            value={ts.color || null}
            presets={presets}
            onChange={(c) => (c ? chain().setColor(c).run() : chain().unsetColor().run())}
          />
          <ColorPicker
            label="Background"
            value={ts.backgroundColor || null}
            presets={presets}
            onChange={(c) => (c ? chain().setTextBackground(c).run() : chain().unsetTextBackground().run())}
          />
        </div>
      )}

      {panel === 'style' && (
        <div className="hm-bubble-panel hm-style-list">
          <div className="hm-cp-label">Custom styles</div>
          <button type="button" className={`hm-style-item ${!ts.styleId ? 'is-active' : ''}`} onMouseDown={keep} onClick={() => chain().unsetCustomStyle().run()}>
            None
          </button>
          {customStyles.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`hm-style-item ${ts.styleId === s.id ? 'is-active' : ''}`}
              onMouseDown={keep}
              onClick={() => chain().setCustomStyle(s.id).run()}
            >
              <span className={`hm-cs-${cssId(s.id)}`}>{s.name}</span>
            </button>
          ))}
          <button type="button" className="hm-style-manage" onMouseDown={keep} onClick={() => navigate('/settings/typography')}>
            Manage styles…
          </button>
        </div>
      )}

      {panel === 'link' && (
        <div className="hm-bubble-panel hm-link-panel">
          <div className="hm-link-row">
            <input
              autoFocus
              className="input sm"
              placeholder="Paste a link, or type a page title…"
              value={href}
              onChange={(e) => {
                setHref(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (searching && e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, pageResults.length - 1));
                } else if (searching && e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === 'Escape') setPanel(null);
              }}
            />
            <Btn title="Apply" onClick={applyLink}><Check size={15} /></Btn>
            <Btn title="Remove link" onClick={() => { chain().extendMarkRange('link').unsetLink().run(); setPanel(null); }}><X size={15} /></Btn>
          </div>
          {searching && (
            <>
              <div className="hm-cp-label">{href.trim() ? 'Link to page' : 'Recent pages'}</div>
              <PageResults results={pageResults} active={active} onHover={setActive} onPick={(n) => applyHref(noteHref(n.id))} />
            </>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}
