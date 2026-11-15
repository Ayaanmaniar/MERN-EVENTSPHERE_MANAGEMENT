import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import useLive from '../../api/useLive';
import { useToast } from '../../context/Toast';
import FloorPlan from '../../components/FloorPlan';
import { Empty, Field, Loading, Tag } from '../../components/ui';

// /exhibitor/booth           -> pick which approved expo
// /exhibitor/booth/:expoId   -> floor plan, reserve + manage details
export default function MyBooth() {
  const { expoId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [apps, setApps] = useState(null);
  const [expo, setExpo] = useState(null);
  const [booths, setBooths] = useState([]);
  const [sel, setSel] = useState(null);
  const [details, setDetails] = useState(null);

  useEffect(() => { api.get('/applications/mine').then((r) => setApps(r.data.applications.filter((a) => a.status === 'approved'))); }, []);
  const load = useCallback(() => {
    if (!expoId) return;
    api.get(`/booths/expo/${expoId}`).then((r) => setBooths(r.data.booths));
  }, [expoId]);
  useEffect(() => { if (expoId) { api.get(`/expos/${expoId}`).then((r) => setExpo(r.data.expo)); load(); } }, [expoId]);
  useLive(expoId, { 'booth:updated': load, 'booths:changed': load });

  const myBoothId = apps?.find((a) => a.expo._id === expoId)?.booth?._id;
  const myBooth = booths.find((b) => b._id === myBoothId);
  useEffect(() => {
    if (myBooth) setDetails({ title: myBooth.details?.title || '', productsShowcased: myBooth.details?.productsShowcased || '', staff: myBooth.details?.staff || [] });
    else setDetails(null);
  }, [myBooth?._id]);

  const refreshApps = () => api.get('/applications/mine').then((r) => setApps(r.data.applications.filter((a) => a.status === 'approved')));
  const reserve = async () => {
    try { await api.post(`/booths/${sel}/reserve`); toast('Booth reserved!', 'success'); setSel(null); await refreshApps(); load(); } catch (e) { toast(errMsg(e), 'error'); load(); }
  };
  const release = async () => {
    if (!confirm('Release your booth so you can pick another?')) return;
    try { await api.post(`/booths/${myBooth._id}/release`); toast('Booth released', 'success'); await refreshApps(); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const saveDetails = async (e) => {
    e.preventDefault();
    try { await api.put(`/booths/${myBooth._id}/details`, details); toast('Booth details saved', 'success'); load(); } catch (e2) { toast(errMsg(e2), 'error'); }
  };

  if (!apps) return <Loading />;
  if (!expoId) {
    return (
      <>
        <div className="page-head"><h1>My booth</h1></div>
        {!apps.length ? <Empty>You need an approved application first. <Link to="/exhibitor/applications">Apply to an expo</Link></Empty> : (
          <div className="grid c3">{apps.map((a) => <div className="card stack" key={a._id}><b>{a.expo.title}</b><div>{a.booth ? <Tag kind="ok">Booth {a.booth.code}</Tag> : <Tag>No booth yet</Tag>}</div><button className="btn sm" onClick={() => nav(`/exhibitor/booth/${a.expo._id}`)}>{a.booth ? 'Manage booth' : 'Choose booth'}</button></div>)}</div>
        )}
      </>
    );
  }
  if (!expo) return <Loading />;
  if (!apps.find((a) => a.expo._id === expoId)) return <Empty>Your application for this expo has not been approved.</Empty>;
  const cur = booths.find((b) => b._id === sel);
  return (
    <>
      <div className="page-head"><div><Link to="/exhibitor/booth" className="small">← My expos</Link><h1>{expo.title}</h1></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card" style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <h2>{myBooth ? `Your booth: ${myBooth.code}` : 'Select your booth'}</h2>
          <FloorPlan expo={expo} booths={booths} myBoothId={myBoothId} selectedId={sel} onSelect={(b) => setSel(b._id)} />
          {!myBooth && cur && (
            <div className="alert info row between" style={{ marginTop: 12 }}>
              <span>Booth <b>{cur.code}</b> · {cur.size} · ${cur.price} · <Tag>{cur.status}</Tag></span>
              <button className="btn sm" disabled={cur.status !== 'available'} onClick={reserve}>Reserve this booth</button>
            </div>
          )}
          {myBooth && <button className="btn danger sm" style={{ marginTop: 12 }} onClick={release}>Release my booth</button>}
        </div>
        {myBooth && details && (
          <form className="card" onSubmit={saveDetails}>
            <h2>Booth details</h2>
            <Field label="Booth title"><input value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} /></Field>
            <Field label="Products / services showcased"><textarea value={details.productsShowcased} onChange={(e) => setDetails({ ...details, productsShowcased: e.target.value })} /></Field>
            <h3>Booth staff</h3>
            {details.staff.map((s, i) => (
              <div className="row" key={i} style={{ marginBottom: 6 }}>
                {['name', 'role', 'phone'].map((k) => <input key={k} style={{ flex: 1, minWidth: 80 }} placeholder={k} aria-label={`Staff ${k}`} value={s[k] || ''} onChange={(e) => { const staff = [...details.staff]; staff[i] = { ...s, [k]: e.target.value }; setDetails({ ...details, staff }); }} />)}
                <button type="button" className="btn danger sm" aria-label="Remove staff" onClick={() => setDetails({ ...details, staff: details.staff.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="btn ghost sm" onClick={() => setDetails({ ...details, staff: [...details.staff, { name: '', role: '', phone: '' }] })}>+ Add staff</button>
            <div style={{ marginTop: 14 }}><button className="btn">Save details</button></div>
          </form>
        )}
      </div>
    </>
  );
}
