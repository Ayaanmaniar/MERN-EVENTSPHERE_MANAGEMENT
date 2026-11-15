import { Tag, groupByDay, fmtTime, fmtDate } from './ui';

export default function Schedule({ sessions, onRegister, onBookmark, admin, onEdit, onDelete }) {
  if (!sessions.length) return <div className="empty">No sessions scheduled yet.</div>;
  return groupByDay(sessions).map(([day, list]) => (
    <div className="day" key={day}>
      <h3>{fmtDate(day)}</h3>
      {list.map((s) => (
        <div className="session" key={s._id}>
          <div className="time">{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</div>
          <div className="body">
            <b>{s.title}</b> <Tag kind="ok">{s.type}</Tag>
            <div className="muted small">
              {s.speaker && <>🎤 {s.speaker} · </>}{s.location && <>📍 {s.location} · </>}{s.topic && <>🏷 {s.topic}</>}
            </div>
            {s.description && <div className="small">{s.description}</div>}
            <div className="muted small">
              {s.registeredCount ?? 0}{s.capacity ? ` / ${s.capacity}` : ''} registered
              {s.capacity > 0 && s.registeredCount >= s.capacity && <> · <Tag kind="rejected">full</Tag></>}
            </div>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            {admin ? (
              <>
                <button className="btn ghost sm" onClick={() => onEdit(s)}>Edit</button>
                <button className="btn danger sm" onClick={() => onDelete(s)}>Delete</button>
              </>
            ) : (
              <>
                {onRegister && <button className={`btn sm ${s.registered ? 'ok' : ''}`} onClick={() => onRegister(s)}>{s.registered ? '✓ Registered' : 'Register'}</button>}
                {onBookmark && <button className="btn ghost sm" onClick={() => onBookmark(s)} aria-pressed={s.bookmarked}>{s.bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  ));
}
