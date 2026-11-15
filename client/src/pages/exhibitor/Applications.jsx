import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/Toast';
import { Empty, Field, Loading, Modal, Tag, fmtDate } from '../../components/ui';

export default function ExhibitorApplications() {
  const toast = useToast();
  const [apps, setApps] = useState(null);
  const [expos, setExpos] = useState([]);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState([]);
  const load = () => api.get('/applications/mine').then((r) => setApps(r.data.applications));
  useEffect(() => { load(); api.get('/expos').then((r) => setExpos(r.data.expos.filter((e) => e.status === 'published'))); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    ['expo', 'companyName', 'products', 'message'].forEach((k) => fd.append(k, form[k] || ''));
    files.forEach((f) => fd.append('documents', f));
    try { await api.post('/applications', fd); toast('Application submitted', 'success'); setForm(null); setFiles([]); load(); } catch (e2) { toast(errMsg(e2), 'error'); }
  };
  if (!apps) return <Loading />;
  const applied = new Set(apps.map((a) => a.expo?._id));
  return (
    <>
      <div className="page-head"><h1>My expo applications</h1></div>
      <h2>Open for applications</h2>
      <div className="grid c3" style={{ marginBottom: 24 }}>
        {expos.filter((e) => !applied.has(e._id)).map((e) => (
          <div key={e._id} className="card stack"><b>{e.title}</b><div className="small muted">{e.location} · {fmtDate(e.startDate)}</div>
            <button className="btn sm" onClick={async () => { const { data } = await api.get('/exhibitors/me/profile'); setForm({ expo: e._id, expoTitle: e.title, companyName: data.profile.companyName, products: data.profile.products.join(', '), message: '' }); }}>Apply</button></div>
        ))}
        {expos.every((e) => applied.has(e._id)) && <Empty>You've applied to every open expo.</Empty>}
      </div>
      <h2>Submitted</h2>
      {!apps.length ? <Empty>No applications yet.</Empty> : (
        <div className="card table-wrap"><table><thead><tr><th>Expo</th><th>Date</th><th>Status</th><th>Booth</th><th>Note</th></tr></thead><tbody>
          {apps.map((a) => (
            <tr key={a._id}><td><b>{a.expo?.title}</b></td><td>{fmtDate(a.createdAt)}</td><td><Tag>{a.status}</Tag></td>
              <td>{a.booth ? a.booth.code : a.status === 'approved' ? <Link to={`/exhibitor/booth/${a.expo._id}`}>Choose a booth →</Link> : '—'}</td><td className="small">{a.adminNote}</td></tr>
          ))}</tbody></table></div>
      )}
      {form && (
        <Modal title={`Apply: ${form.expoTitle}`} onClose={() => setForm(null)}>
          <form onSubmit={submit}>
            <Field label="Company name"><input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
            <Field label="Products / services you will showcase"><textarea value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} /></Field>
            <Field label="Message to organizers"><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            <Field label="Required documents" hint="Business license, insurance, etc. (pdf, doc, image, zip — max 5 files, 5MB each)"><input type="file" multiple onChange={(e) => setFiles([...e.target.files])} /></Field>
            <button className="btn">Submit application</button>
          </form>
        </Modal>
      )}
    </>
  );
}
