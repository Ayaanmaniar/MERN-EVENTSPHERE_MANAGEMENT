import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import useLive from '../api/useLive';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { Alert, Empty, Loading, Modal, Tag, fmtDate } from '../components/ui';
import FloorPlan from '../components/FloorPlan';
import Schedule from '../components/Schedule';

export default function ExpoDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('info');
  const [sessions, setSessions] = useState([]);
  const [booths, setBooths] = useState([]);
  const [exhibitors, setExhibitors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');

  const loadExpo = useCallback(() => api.get(`/expos/${id}`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e))), [id]);
  const loadSessions = useCallback(() => api.get(`/sessions/expo/${id}`).then((r) => setSessions(r.data.sessions)), [id]);
  const loadBooths = useCallback(() => api.get(`/booths/expo/${id}`).then((r) => setBooths(r.data.booths)), [id]);
  const loadExhibitors = useCallback(() => api.get('/exhibitors', { params: { expo: id } }).then((r) => setExhibitors(r.data.exhibitors)), [id]);

  useEffect(() => { loadExpo(); loadSessions(); loadBooths(); loadExhibitors(); }, [id, user]);

  // real-time updates
  useLive(id, {
    'schedule:changed': () => { loadSessions(); setLive(true); toast('Schedule was updated', 'info'); },
    'booth:updated': () => { loadBooths(); loadExhibitors(); loadExpo(); },
    'booths:changed': () => { loadBooths(); loadExpo(); },
    'expo:updated': () => { loadExpo(); toast('Event details were updated', 'info'); },
  });

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  const { expo, stats, registered } = data;
  const needLogin = () => { toast('Please log in first', 'error'); nav('/login'); };

  const registerExpo = async () => {
    if (!user) return needLogin();
    try {
      if (registered) await api.delete(`/expos/${id}/register`); else await api.post(`/expos/${id}/register`);
      toast(registered ? 'Registration cancelled' : 'You are registered!', 'success');
      loadExpo();
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const toggle = (kind) => async (s) => {
    if (!user) return needLogin();
    try { await api.post(`/sessions/${s._id}/${kind}`); loadSessions(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const openBooth = async (b) => {
    setSelected(b);
    api.get(`/booths/${b._id}`).catch(() => {}); // records a visit for booth traffic analytics
  };
  const sel = selected && booths.find((b) => b._id === selected._id);
  const exOfBooth = sel && exhibitors.find((x) => String(x.user) === String(sel.exhibitor));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{expo.title} <Tag>{expo.status}</Tag></h1>
          {expo.theme && <div className="muted"><i>{expo.theme}</i></div>}
          <div className="muted">📍 {expo.location} · 📅 {fmtDate(expo.startDate)} – {fmtDate(expo.endDate)}</div>
        </div>
        <div className="row">
          {live && <span className="small"><span className="dot-live" />Live updates on</span>}
          {(!user || user.role === 'attendee') && <button className={`btn ${registered ? 'ok' : ''}`} onClick={registerExpo}>{registered ? '✓ Registered (click to cancel)' : 'Register for this expo'}</button>}
          {user?.role === 'exhibitor' && <Link className="btn" to="/exhibitor/applications">Apply as exhibitor</Link>}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {[['info', 'Overview'], ['schedule', `Schedule (${sessions.length})`], ['exhibitors', `Exhibitors (${exhibitors.length})`], ['floor', 'Floor plan']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid c2">
          <div className="card"><h2>About</h2><p>{expo.description || 'No description yet.'}</p></div>
          <div className="grid c3">
            <div className="card stat"><div className="n">{stats.sessions}</div><div className="l">Sessions & workshops</div></div>
            <div className="card stat"><div className="n">{exhibitors.length}</div><div className="l">Exhibitors</div></div>
            <div className="card stat"><div className="n">{stats.boothTotal - stats.boothReserved}</div><div className="l">Booths still available</div></div>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="card">
          <Schedule sessions={sessions} onRegister={user?.role === 'admin' ? null : toggle('register')} onBookmark={user?.role === 'admin' ? null : toggle('bookmark')} />
        </div>
      )}

      {tab === 'exhibitors' && (
        exhibitors.length === 0 ? <Empty>No approved exhibitors yet.</Empty> : (
          <div className="grid c3">
            {exhibitors.map((x) => (
              <Link key={x._id} to={`/exhibitors/${x.user}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="row">{x.logo ? <img className="logo" src={x.logo} alt="" /> : <div className="logo">{x.companyName[0]}</div>}<div><b>{x.companyName}</b><div className="small muted">{x.category}</div></div></div>
                <p className="small">{(x.description || '').slice(0, 90)}</p>
                {x.booth && <Tag kind="ok">Booth {x.booth.code}</Tag>}
              </Link>
            ))}
          </div>
        )
      )}

      {tab === 'floor' && (
        <div className="card">
          <h2>Floor plan</h2>
          <p className="muted small">Click a booth to see who is there. Booth status changes appear instantly.</p>
          {booths.length ? <FloorPlan expo={expo} booths={booths} onSelect={openBooth} /> : <Empty>The floor plan has not been published yet.</Empty>}
        </div>
      )}

      {sel && (
        <Modal title={`Booth ${sel.code}`} onClose={() => setSelected(null)}>
          <p><Tag>{sel.status}</Tag> {sel.size} booth</p>
          {sel.status === 'reserved' && sel.profile ? (
            <div className="stack">
              <div><b>{sel.profile.companyName}</b> <span className="muted">({sel.profile.category})</span></div>
              {sel.details?.title && <div>{sel.details.title}</div>}
              {sel.details?.productsShowcased && <div className="small">Showcasing: {sel.details.productsShowcased}</div>}
              <div className="row">
                <Link className="btn ghost sm" to={`/exhibitors/${sel.exhibitor}`}>View profile</Link>
                {user && String(user._id) !== String(sel.exhibitor) && <Link className="btn sm" to={`/messages?to=${sel.exhibitor}`}>Message exhibitor</Link>}
              </div>
            </div>
          ) : <p className="muted">{sel.status === 'available' ? 'This booth is still available.' : 'This space is not open for booking.'}</p>}
        </Modal>
      )}
    </>
  );
}
