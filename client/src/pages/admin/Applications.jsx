import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/Toast';
import { Empty, Loading, Modal, Tag, fmtDate } from '../../components/ui';

export default function Applications() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('pending');
  const [dlg, setDlg] = useState(null);
  const [booths, setBooths] = useState([]);
  const load = () => api.get('/applications', { params: { status: status || undefined } }).then((r) => setList(r.data.applications));
  useEffect(() => { load(); }, [status]);

  const open = async (app, action) => {
    setDlg({ app, action, note: '', boothId: '' });
    if (action === 'approved') api.get(`/booths/expo/${app.expo._id}`).then((r) => setBooths(r.data.booths.filter((b) => b.status === 'available')));
  };
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/applications/${dlg.app._id}/status`, { status: dlg.action, adminNote: dlg.note, boothId: dlg.boothId || undefined });
      toast(`Application ${dlg.action}`, 'success'); setDlg(null); load();
    } catch (e2) { toast(errMsg(e2), 'error'); }
  };
  return (
    <>
      <div className="page-head"><h1>Exhibitor applications</h1>
        <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status"><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
      {!list ? <Loading /> : !list.length ? <Empty>No applications here.</Empty> : (
        <div className="grid c2">
          {list.map((a) => (
            <div className="card stack" key={a._id}>
              <div className="row between"><h3 style={{ margin: 0 }}>{a.companyName}</h3><Tag>{a.status}</Tag></div>
              <div className="small muted">{a.expo?.title} · {a.exhibitor?.name} ({a.exhibitor?.email}) · {fmtDate(a.createdAt)}</div>
              {a.products && <div className="small"><b>Products:</b> {a.products}</div>}
              {a.message && <div className="small"><b>Message:</b> {a.message}</div>}
              {a.documents?.length > 0 && <div className="small"><b>Documents:</b> {a.documents.map((d) => <a key={d.url} href={d.url} target="_blank" rel="noreferrer noopener" style={{ marginRight: 8 }}>{d.name}</a>)}</div>}
              {a.booth && <div className="small">Booth: <b>{a.booth.code}</b></div>}
              {a.adminNote && <div className="small muted">Note: {a.adminNote}</div>}
              <div className="row">
                {a.status !== 'approved' && <button className="btn ok sm" onClick={() => open(a, 'approved')}>Approve</button>}
                {a.status !== 'rejected' && <button className="btn danger sm" onClick={() => open(a, 'rejected')}>Reject</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {dlg && (
        <Modal title={`${dlg.action === 'approved' ? 'Approve' : 'Reject'} ${dlg.app.companyName}`} onClose={() => setDlg(null)}>
          <form onSubmit={submit}>
            {dlg.action === 'approved' && (
              <div className="field"><label>Assign a booth now (optional)</label>
                <select value={dlg.boothId} onChange={(e) => setDlg({ ...dlg, boothId: e.target.value })}><option value="">Let the exhibitor choose</option>{booths.map((b) => <option key={b._id} value={b._id}>{b.code} ({b.size}, ${b.price})</option>)}</select></div>
            )}
            <div className="field"><label>Note to exhibitor (optional)</label><textarea value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} /></div>
            <button className={`btn ${dlg.action === 'approved' ? 'ok' : 'danger'}`}>Confirm</button>
          </form>
        </Modal>
      )}
    </>
  );
}
