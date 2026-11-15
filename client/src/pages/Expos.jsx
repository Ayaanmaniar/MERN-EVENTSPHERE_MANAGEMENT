import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import useLive from '../api/useLive';
import { Empty, Loading, Tag, fmtDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Expos() {
  const { user } = useAuth();
  const [expos, setExpos] = useState(null);
  const [search, setSearch] = useState('');
  const load = () => api.get('/expos', { params: { search } }).then((r) => setExpos(r.data.expos));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);
  useLive(null, { 'expo:created': load, 'expo:deleted': load });

  return (
    <>
      <div className="hero">
        <h1>Discover expos & trade shows</h1>
        <p>Browse events, explore floor plans, find exhibitors and build your own schedule — all updated in real time.</p>
        {!user && <Link to="/register" className="btn" style={{ background: '#fff', color: '#4338ca' }}>Join EventSphere</Link>}
      </div>
      <div className="page-head">
        <h2 style={{ margin: 0 }}>Upcoming events</h2>
        <input style={{ maxWidth: 280 }} placeholder="Search title, location, theme…" aria-label="Search expos" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {!expos ? <Loading /> : !expos.length ? <Empty>No expos found.</Empty> : (
        <div className="grid c2">
          {expos.map((e) => (
            <Link to={`/expos/${e._id}`} key={e._id} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row between"><h3 style={{ margin: 0 }}>{e.title}</h3><Tag>{e.status}</Tag></div>
              {e.theme && <div className="muted"><i>{e.theme}</i></div>}
              <p className="small">{(e.description || '').slice(0, 140)}{(e.description || '').length > 140 ? '…' : ''}</p>
              <div className="small muted">📍 {e.location} · 📅 {fmtDate(e.startDate)} – {fmtDate(e.endDate)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
