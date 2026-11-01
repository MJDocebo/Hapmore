import { ReactRenderer } from '@tiptap/react';

/**
 * Generic popup renderer for @tiptap/suggestion.
 * Escape dismisses the menu for the current trigger so the typed characters stay as plain text.
 */
export function createSuggestionRenderer(Component) {
  return () => {
    let component = null;
    let el = null;
    let dismissedFrom = null;
    let lastProps = null;

    const isHidden = (props) => !props.items || props.items.length === 0 || dismissedFrom === props.range.from;

    const place = (props) => {
      if (!el) return;
      if (isHidden(props)) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      const rect = props.clientRect && props.clientRect();
      if (!rect) return;
      el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 340))}px`;
      el.style.top = `${rect.bottom + 6}px`;
      requestAnimationFrame(() => {
        if (!el) return;
        const h = el.offsetHeight;
        if (rect.bottom + 6 + h > window.innerHeight - 8) el.style.top = `${Math.max(8, rect.top - h - 6)}px`;
      });
    };

    return {
      onStart(props) {
        dismissedFrom = null;
        lastProps = props;
        component = new ReactRenderer(Component, { props, editor: props.editor });
        el = component.element;
        el.classList.add('hm-suggest-root');
        el.style.position = 'fixed';
        el.style.zIndex = '1000';
        document.body.appendChild(el);
        place(props);
      },
      onUpdate(props) {
        lastProps = props;
        if (component) component.updateProps(props);
        place(props);
      },
      onKeyDown(props) {
        if (!lastProps || isHidden(lastProps)) return false;
        if (props.event.key === 'Escape') {
          dismissedFrom = lastProps.range.from;
          place(lastProps);
          return true;
        }
        return component && component.ref && component.ref.onKeyDown ? component.ref.onKeyDown(props) : false;
      },
      onExit() {
        if (el) el.remove();
        if (component) component.destroy();
        el = null;
        component = null;
        lastProps = null;
      },
    };
  };
}
