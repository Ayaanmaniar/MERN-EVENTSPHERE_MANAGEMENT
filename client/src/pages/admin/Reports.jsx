import { useEffect, useState } from 'react';
import api from '../../api/client';
import useLive from '../../api/useLive';
import { Bars, Empty, Loading } from '../../components/ui';

export default function Reports() {
  const [expos, setExpos] = useState([]);
  const [id, setId] = useState('');
  const [r, setR] = useState(null);
  useEffect(() => { api.get('/expos').then((x) => { setExpos(x.data.expos); if (x.data.expos[0]) setId(x.data.expos[0]._id); }); }, []);
  const load = () => id && api.get(`/analytics/expo/${id}`).then((x) => setR(x.data));
  useEffect(() => { setR(null); load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [id]);
  useLive(id, { 'booth:updated': load, 'schedule:changed': load });

  const download = async () => {
    const { data } = await api.get(`/analytics/expo/${id}/export.csv`, { responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = 'expo-report.csv'; a.click();
  };
  return (
    <>
      <div className="page-head"><div><h1>Reports & analytics</h1><span className="muted small"><span className="dot-live" />Real-time, refreshes every 10 seconds</span></div>
        <div className="row"><select style={{ width: 260 }} value={id} onChange={(e) => setId(e.target.value)} aria-label="Expo">{expos.map((x) => <option key={x._id} value={x._id}>{x.title}</option>)}</select>
          <button className="btn ghost" onClick={download} disabled={!id}>⬇ Export CSV</button> <button className="btn ghost" onClick={() => window.print()}>Print</button></div></div>
      {!expos.length ? <Empty>Create an expo first.</Empty> : !r ? <Loading /> : (
        <>
          <div className="grid c4">
            <div className="card stat"><div className="n">{r.attendees}</div><div className="l">Registered attendees</div></div>
            <div className="card stat"><div className="n">{r.sessions}</div><div className="l">Sessions</div></div>
            <div className="card stat"><div className="n">{r.booths.occupancyRate}%</div><div className="l">Booth occupancy ({r.booths.reserved}/{r.booths.total})</div></div>
            <div className="card stat"><div className="n">{r.boothTraffic.reduce((s, b) => s + b.visits, 0)}</div><div className="l">Booth visits</div></div>
          </div>
          <div className="grid c2" style={{ marginTop: 16 }}>
            <div className="card"><h2>Session popularity</h2><p className="small muted">Registrations + bookmarks</p>
              <Bars rows={r.sessionPopularity.map((s) => ({ ...s, total: s.registrations + s.bookmarks }))} labelKey="title" valueKey="total" /></div>
            <div className="card"><h2>Booth traffic</h2><p className="small muted">Visits per booth</p>
              <Bars rows={r.boothTraffic.map((b) => ({ ...b, label: `${b.code}${b.company ? ' · ' + b.company : ''}` }))} labelKey="label" valueKey="visits" /></div>
            <div className="card"><h2>Visits by day</h2><Bars rows={r.visitsByDay} labelKey="date" valueKey="visits" /></div>
            <div className="card"><h2>Exhibitor applications</h2>
              <Bars rows={['pending', 'approved', 'rejected'].map((k) => ({ k, n: r.applications[k] || 0 }))} labelKey="k" valueKey="n" /></div>
          </div>
          <p className="small muted">Generated {new Date(r.generatedAt).toLocaleString()}</p>
        </>
      )}
    </>
  );
}
