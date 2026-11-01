// Mermaid is large, so it is loaded on demand the first time a flowchart block renders (separate Vite chunk).
let loader = null;
let seq = 0;
let queue = Promise.resolve();

export function loadMermaid() {
  if (!loader) {
    loader = import('mermaid')
      .then((m) => m.default || m)
      .catch((err) => {
        loader = null; // allow a retry (e.g. after a flaky network)
        throw err;
      });
  }
  return loader;
}

function cleanError(err) {
  const msg = String(err?.message || err || 'Could not draw this diagram');
  // Mermaid parse errors are multi-line with a caret diagram; keep the useful first lines.
  return msg.split('\n').slice(0, 4).join('\n').trim();
}

/**
 * Renders Mermaid source to an SVG string. securityLevel 'strict' makes Mermaid sanitize labels and disables
 * click handlers/scripts, so the returned SVG is safe to inject. Renders are serialized because Mermaid's
 * global config (theme) is shared.
 */
export function renderMermaid(code, { dark = false } = {}) {
  const job = queue.then(async () => {
    const mermaid = await loadMermaid();
    const css = getComputedStyle(document.documentElement);
    const font = css.getPropertyValue('--font-body').trim() || 'system-ui, sans-serif';
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: dark ? 'dark' : 'neutral',
      fontFamily: font,
      themeVariables: { fontFamily: font, fontSize: '14px' },
      flowchart: { curve: 'basis', padding: 12, useMaxWidth: true },
      sequence: { useMaxWidth: true },
    });
    const id = `hm-mermaid-${Date.now().toString(36)}-${++seq}`;
    try {
      await mermaid.parse(code);
      const { svg } = await mermaid.render(id, code);
      return { svg };
    } catch (err) {
      return { error: cleanError(err) };
    } finally {
      // Mermaid leaves a temporary container behind when a render fails.
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  });
  queue = job.catch(() => {});
  return job;
}

export const FLOWCHART_TEMPLATES = [
  {
    id: 'td',
    label: 'Flowchart ↓',
    code: `flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Ship it]
    B -- No --> D[Debug]
    D --> B`,
  },
  {
    id: 'lr',
    label: 'Flowchart →',
    code: `flowchart LR
    Input[/Input/] --> Parse[Parse] --> Validate{Valid?}
    Validate -- yes --> Store[(Database)]
    Validate -- no --> Error([Show error])`,
  },
  {
    id: 'seq',
    label: 'Sequence',
    code: `sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: Request
    S-->>C: Response`,
  },
  {
    id: 'state',
    label: 'State',
    code: `stateDiagram-v2
    [*] --> Ready
    Ready --> Running: schedule
    Running --> Blocked: wait for I/O
    Blocked --> Ready: I/O done
    Running --> [*]: exit`,
  },
];

export const DEFAULT_FLOWCHART = FLOWCHART_TEMPLATES[0].code;
