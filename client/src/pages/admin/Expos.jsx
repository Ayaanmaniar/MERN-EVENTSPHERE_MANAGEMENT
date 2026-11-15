import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/Toast';
import { Alert, Empty, Field, Loading, Modal, Tag, fmtDate, toInputDate } from '../../components/ui';

const blank = { title: '', theme: '', location: '', description: '', startDate: '', endDate: '', status: 'published' };

export default function AdminExpos() {
  const toast = useToast();
  const [expos, setExpos] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api.get('/expos').then((r) => setExpos(r.data.expos));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setErr('');
    try {
      if (edit._id) await api.put(`/expos/${edit._id}`, edit); else await api.post('/expos', edit);
      toast('Expo saved', 'success'); setEdit(null); load();
    } catch (e2) { setErr(errMsg(e2)); }
  };
  const del = async (x) => {
    if (!confirm(`Delete "${x.title}" and ALL its booths, sessions and registrations?`)) return;
    try { await api.delete(`/expos/${x._id}`); toast('Expo deleted', 'success'); load(); } catch (e2) { toast(errMsg(e2), 'error'); }
  };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <>
      <div className="page-head"><h1>Expos</h1><button className="btn" onClick={() => setEdit({ ...blank })}>+ New expo</button></div>
      {!expos ? <Loading /> : !expos.length ? <Empty>No expos yet. Create your first one.</Empty> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Dates</th><th>Location</th><th>Status</th><th /></tr></thead>
            <tbody>
              {expos.map((x) => (
                <tr key={x._id}>
                  <td><b>{x.title}</b><div className="muted small">{x.theme}</div></td>
                  <td>{fmtDate(x.startDate)} – {fmtDate(x.endDate)}</td><td>{x.location}</td><td><Tag>{x.status}</Tag></td>
                  <td className="right"><div className="row" style={{ justifyContent: 'flex-end' }}>
                    <Link className="btn sm" to={`/admin/expos/${x._id}`}>Booths & schedule</Link>
                    <button className="btn ghost sm" onClick={() => setEdit({ ...x, startDate: toInputDate(x.startDate), endDate: toInputDate(x.endDate) })}>Edit</button>
                    <button className="btn danger sm" onClick={() => del(x)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit._id ? 'Edit expo' : 'New expo'} onClose={() => setEdit(null)}>
          <Alert>{err}</Alert>
          <form onSubmit={save}>
            <Field label="Title"><input required value={edit.title} onChange={set('title')} /></Field>
            <Field label="Theme"><input value={edit.theme} onChange={set('theme')} /></Field>
            <Field label="Location"><input required value={edit.location} onChange={set('location')} /></Field>
            <div className="form-grid">
              <Field label="Start date"><input type="date" required value={edit.startDate} onChange={set('startDate')} /></Field>
              <Field label="End date"><input type="date" required value={edit.endDate} onChange={set('endDate')} /></Field>
            </div>
            <Field label="Description"><textarea value={edit.description} onChange={set('description')} /></Field>
            <Field label="Status"><select value={edit.status} onChange={set('status')}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="completed">Completed</option></select></Field>
            <button className="btn">Save expo</button>
          </form>
        </Modal>
      )}
    </>
  );
}
