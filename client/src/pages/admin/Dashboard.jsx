import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import useLive from '../../api/useLive';
import { Loading } from '../../components/ui';

export default function Dashboard() {
  const [o, setO] = useState(null);
  const load = () => api.get('/analytics/overview').then((r) => setO(r.data));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  useLive(null, { 'notification:new': load });
  if (!o) return <Loading />;
  const cards = [
    ['Expos', o.expos], ['Exhibitors', o.exhibitors], ['Attendees', o.attendees], ['Pending applications', o.pendingApps],
    ['Booths reserved', `${o.reserved} / ${o.booths}`], ['Expo registrations', o.registrations], ['Session sign-ups', o.sessionRegistrations],
    ['Booth visits', o.boothVisits], ['Open feedback', o.openFeedback],
  ];
  return (
    <>
      <div className="page-head"><div><h1>Organizer dashboard</h1><div className="muted small"><span className="dot-live" />Live figures, refreshed automatically</div></div></div>
      <div className="grid c4">{cards.map(([l, n]) => <div className="card stat" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}</div>
      <div className="grid c3" style={{ marginTop: 20 }}>
        <Link className="card" to="/admin/expos" style={{ textDecoration: 'none', color: 'inherit' }}><h3>Manage expos →</h3><span className="muted small">Create events, booths & schedules</span></Link>
        <Link className="card" to="/admin/applications" style={{ textDecoration: 'none', color: 'inherit' }}><h3>Review applications →</h3><span className="muted small">{o.pendingApps} waiting for a decision</span></Link>
        <Link className="card" to="/admin/reports" style={{ textDecoration: 'none', color: 'inherit' }}><h3>Reports & analytics →</h3><span className="muted small">Engagement, traffic, popularity</span></Link>
      </div>
    </>
  );
}
