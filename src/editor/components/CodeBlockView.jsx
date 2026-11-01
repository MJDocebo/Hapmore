import { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { CODE_LANGUAGES } from '../languages';
import { Check, Copy } from '../../components/icons';
import { isHex } from '../../lib/utils';

export default function CodeBlockView({ node, updateAttributes, editor }) {
  const lang = node.attrs.language || 'plaintext';
  const [copied, setCopied] = useState(false);
  const known = CODE_LANGUAGES.some(([v]) => v === lang);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_) {
      /* clipboard blocked */
    }
  };

  return (
    <NodeViewWrapper
      className={`hm-code ${node.attrs.blockBg ? 'has-bg' : ''}`}
      data-block-id={node.attrs.blockId || undefined}
      style={isHex(node.attrs.blockBg) ? { '--block-bg': node.attrs.blockBg } : undefined}
    >
      <div className="hm-code-bar" contentEditable={false}>
        <select className="hm-code-lang" value={lang} disabled={!editor.isEditable} onChange={(e) => updateAttributes({ language: e.target.value })}>
          {!known && <option value={lang}>{lang}</option>}
          {CODE_LANGUAGES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" className="hm-code-copy" onClick={copy} title="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent as="code" className={`hljs language-${lang}`} />
      </pre>
    </NodeViewWrapper>
  );
}
