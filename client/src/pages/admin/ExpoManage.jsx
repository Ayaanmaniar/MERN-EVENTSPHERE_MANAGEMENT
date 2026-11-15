import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import useLive from '../../api/useLive';
import { useToast } from '../../context/Toast';
import { Alert, Empty, Field, Loading, Modal, Tag, toInputDateTime } from '../../components/ui';
import FloorPlan from '../../components/FloorPlan';
import Schedule from '../../components/Schedule';

export default function ExpoManage() {
  const { id } = useParams();
  const toast = useToast();
  const [expo, setExpo] = useState(null);
  const [tab, setTab] = useState('booths');
  const [booths, setBooths] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [approved, setApproved] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [sel, setSel] = useState(null);
  const [grid, setGrid] = useState({ rows: 4, cols: 6, price: 500 });
  const [sess, setSess] = useState(null);
  const [err, setErr] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const loadBooths = useCallback(() => api.get(`/booths/expo/${id}`).then((r) => setBooths(r.data.booths)), [id]);
  const loadSessions = useCallback(() => api.get(`/sessions/expo/${id}`).then((r) => setSessions(r.data.sessions)), [id]);
  const loadApproved = useCallback(() => api.get('/applications', { params: { expo: id, status: 'approved' } }).then((r) => setApproved(r.data.applications)), [id]);
  useEffect(() => {
    api.get(`/expos/${id}`).then((r) => { setExpo(r.data.expo); setGrid((g) => ({ ...g, rows: r.data.expo.floorPlan.rows, cols: r.data.expo.floorPlan.cols })); });
    loadBooths(); loadSessions(); loadApproved();
    api.get(`/expos/${id}/attendees`).then((r) => setAttendees(r.data.attendees));
  }, [id]);
  useLive(id, { 'booth:updated': () => { loadBooths(); loadApproved(); }, 'booths:changed': loadBooths, 'schedule:changed': loadSessions });

  if (!expo) return <Loading />;
  const cur = sel && booths.find((b) => b._id === sel);
  const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg, 'success'); loadBooths(); loadApproved(); } catch (e) { toast(errMsg(e), 'error'); } };

  const generate = (e) => { e.preventDefault(); act(() => api.post(`/booths/expo/${id}/generate`, grid), 'Floor plan generated'); };
  const saveSession = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const body = { ...sess, expo: id, startTime: new Date(sess.startTime).toISOString(), endTime: new Date(sess.endTime).toISOString() };
      if (sess._id) await api.put(`/sessions/${sess._id}`, body); else await api.post('/sessions', body);
      toast('Session saved — attendees were notified of changes', 'success'); setSess(null); loadSessions();
    } catch (e2) { setErr(errMsg(e2)); }
  };
  const delSession = async (s) => { if (confirm(`Delete "${s.title}"?`)) { await api.delete(`/sessions/${s._id}`); loadSessions(); } };
  const s = (k) => (e) => setSess({ ...sess, [k]: e.target.value });
  const unassigned = approved.filter((a) => !a.booth);

  return (
    <>
      <div className="page-head"><div><Link to="/admin/expos" className="small">← All expos</Link><h1>{expo.title}</h1></div></div>
      <div className="tabs">{[['booths', 'Floor plan & booths'], ['schedule', 'Schedule'], ['attendees', `Attendees (${attendees.length})`]].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'booths' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <form className="row" onSubmit={generate} style={{ alignItems: 'flex-end' }}>
              <Field label="Rows"><input type="number" min="1" max="30" value={grid.rows} onChange={(e) => setGrid({ ...grid, rows: e.target.value })} /></Field>
              <Field label="Columns"><input type="number" min="1" max="30" value={grid.cols} onChange={(e) => setGrid({ ...grid, cols: e.target.value })} /></Field>
              <Field label="Default price"><input type="number" min="0" value={grid.price} onChange={(e) => setGrid({ ...grid, price: e.target.value })} /></Field>
              <div className="field"><button className="btn">{booths.length ? 'Add missing booths' : 'Generate floor plan'}</button></div>
            </form>
          </div>
          <div className="card" style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <h2>Floor plan</h2>
            {booths.length ? <FloorPlan expo={expo} booths={booths} selectedId={sel} onSelect={(b) => setSel(b._id)} /> : <Empty>Generate a floor plan to start allocating booths.</Empty>}
          </div>
          <div className="card">
            <h2>{cur ? `Booth ${cur.code}` : 'Booth details'}</h2>
            {!cur ? <p className="muted">Select a booth on the floor plan.</p> : (
              <div className="stack">
                <div><Tag>{cur.status}</Tag> · {cur.size} · ${cur.price}</div>
                {cur.profile && <div>Exhibitor: <b>{cur.profile.companyName}</b></div>}
                <div className="row">
                  <select style={{ width: 120 }} value={cur.size} onChange={(e) => act(() => api.put(`/booths/${cur._id}`, { size: e.target.value }))}><option>small</option><option>medium</option><option>large</option></select>
                  <input style={{ width: 100 }} type="number" defaultValue={cur.price} key={cur._id + cur.price} onBlur={(e) => Number(e.target.value) !== cur.price && act(() => api.put(`/booths/${cur._id}`, { price: Number(e.target.value) }), 'Price updated')} aria-label="Price" />
                </div>
                {cur.status === 'available' && (
                  <>
                    <div className="row">
                      <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Exhibitor to assign">
                        <option value="">Assign to approved exhibitor…</option>
                        {unassigned.map((a) => <option key={a._id} value={a.exhibitor._id}>{a.companyName}</option>)}
                      </select>
                      <button className="btn sm" disabled={!assignTo} onClick={() => act(() => api.post(`/booths/${cur._id}/assign`, { exhibitorId: assignTo }), 'Booth assigned')}>Assign</button>
                    </div>
                    <button className="btn ghost sm" onClick={() => act(() => api.put(`/booths/${cur._id}`, { status: 'blocked' }), 'Booth blocked')}>Block booth</button>
                  </>
                )}
                {cur.status === 'blocked' && <button className="btn ghost sm" onClick={() => act(() => api.put(`/booths/${cur._id}`, { status: 'available' }))}>Unblock</button>}
                {cur.status === 'reserved' && <button className="btn danger sm" onClick={() => act(() => api.post(`/booths/${cur._id}/release`), 'Booth released')}>Release booth</button>}
                {cur.status !== 'reserved' && <button className="btn danger sm" onClick={() => confirm('Delete this booth?') && act(() => api.delete(`/booths/${cur._id}`), 'Booth deleted')}>Delete booth</button>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="card">
          <div className="row between"><h2>Event schedule</h2><button className="btn" onClick={() => setSess({ title: '', topic: '', speaker: '', location: '', description: '', type: 'session', capacity: 0, startTime: '', endTime: '' })}>+ Add session</button></div>
          <Schedule admin sessions={sessions} onEdit={(x) => setSess({ ...x, startTime: toInputDateTime(x.startTime), endTime: toInputDateTime(x.endTime) })} onDelete={delSession} />
        </div>
      )}

      {tab === 'attendees' && (
        <div className="card table-wrap">
          {!attendees.length ? <Empty>No registrations yet.</Empty> : (
            <table><thead><tr><th>Name</th><th>Email</th><th>Registered</th></tr></thead><tbody>{attendees.map((a) => <tr key={a._id}><td>{a.name}</td><td>{a.email}</td><td>{new Date(a.registeredAt).toLocaleString()}</td></tr>)}</tbody></table>
          )}
        </div>
      )}

      {sess && (
        <Modal title={sess._id ? 'Edit session' : 'New session'} onClose={() => setSess(null)}>
          <Alert>{err}</Alert>
          <form onSubmit={saveSession}>
            <Field label="Title"><input required value={sess.title} onChange={s('title')} /></Field>
            <div className="form-grid">
              <Field label="Starts"><input type="datetime-local" required value={sess.startTime} onChange={s('startTime')} /></Field>
              <Field label="Ends"><input type="datetime-local" required value={sess.endTime} onChange={s('endTime')} /></Field>
              <Field label="Speaker"><input value={sess.speaker} onChange={s('speaker')} /></Field>
              <Field label="Location / room"><input value={sess.location} onChange={s('location')} /></Field>
              <Field label="Topic"><input value={sess.topic} onChange={s('topic')} /></Field>
              <Field label="Type"><select value={sess.type} onChange={s('type')}><option>session</option><option>workshop</option><option>keynote</option></select></Field>
              <Field label="Capacity" hint="0 = unlimited"><input type="number" min="0" value={sess.capacity} onChange={s('capacity')} /></Field>
            </div>
            <Field label="Description"><textarea value={sess.description} onChange={s('description')} /></Field>
            <button className="btn">Save session</button>
          </form>
        </Modal>
      )}
    </>
  );
}
