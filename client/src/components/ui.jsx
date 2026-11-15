import { useEffect } from 'react';

export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (d) => `${fmtDate(d)} ${fmtTime(d)}`;
export const toInputDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const Tag = ({ children, kind }) => <span className={`tag ${kind || children}`}>{String(children).replace('_', ' ')}</span>;
export const Alert = ({ type = 'err', children }) => (children ? <div className={`alert ${type}`} role={type === 'err' ? 'alert' : 'status'}>{children}</div> : null);
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Loading = () => <div className="empty">Loading…</div>;

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Bars({ rows, labelKey, valueKey, max }) {
  const m = max || Math.max(1, ...rows.map((r) => r[valueKey]));
  return rows.length ? (
    rows.map((r, i) => (
      <div className="bar-row" key={i}>
        <span title={r[labelKey]} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[labelKey]}</span>
        <div className="bar"><div style={{ width: `${(r[valueKey] / m) * 100}%` }} /></div>
        <b>{r[valueKey]}</b>
      </div>
    ))
  ) : (
    <Empty>No data yet</Empty>
  );
}

export function groupByDay(sessions) {
  const g = {};
  sessions.forEach((s) => {
    const k = new Date(s.startTime).toDateString();
    (g[k] = g[k] || []).push(s);
  });
  return Object.entries(g);
}
