import { Link } from 'react-router-dom';
import { ChevronRight, Home } from './icons';

/**
 * Page-toolbar breadcrumbs. Always starts with Home (handy when the sidebar is collapsed).
 * items: [{ key, label, to?, icon? }] — items with `to` are links; the last item is the current page.
 */
export default function Breadcrumbs({ items = [] }) {
  const all = [{ key: 'home', label: 'Home', to: '/', icon: <Home size={13} /> }, ...items.filter(Boolean)];
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {all.map((it, i) => {
        const last = i === all.length - 1;
        const body = (
          <>
            {it.icon}
            <span className="crumb-text">{it.label}</span>
          </>
        );
        return (
          <span key={it.key || i} className="crumb-item">
            {i > 0 && <ChevronRight size={13} className="crumb-sep" aria-hidden="true" />}
            {last ? (
              <span className="crumb is-current" aria-current="page">{body}</span>
            ) : it.to ? (
              <Link to={it.to} className="crumb">{body}</Link>
            ) : (
              <span className="crumb is-plain">{body}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
