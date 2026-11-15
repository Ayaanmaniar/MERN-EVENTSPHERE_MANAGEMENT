import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/Toast';
import { Empty, Loading, Tag, fmtDateTime } from '../../components/ui';

export default function FeedbackAdmin() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('');
  const [reply, setReply] = useState({});
  const load = () => api.get('/feedback', { params: { status: status || undefined } }).then((r) => setList(r.data.feedback));
  useEffect(() => { load(); }, [status]);
  const update = async (f, body) => { try { await api.put(`/feedback/${f._id}`, body); toast('Updated', 'success'); load(); } catch (e) { toast(errMsg(e), 'error'); } };
  return (
    <>
      <div className="page-head"><h1>Feedback & issues</h1>
        <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div>
      {!list ? <Loading /> : !list.length ? <Empty>No feedback.</Empty> : list.map((f) => (
        <div className="card stack" key={f._id} style={{ marginBottom: 12 }}>
          <div className="row between"><div><b>{f.subject}</b> <Tag kind="ok">{f.type}</Tag> {f.rating && <span>{'★'.repeat(f.rating)}</span>}</div><Tag>{f.status}</Tag></div>
          <div className="small muted">{f.user?.name} ({f.user?.role}) · {f.user?.email} · {fmtDateTime(f.createdAt)}</div>
          <div>{f.message}</div>
          {f.adminReply && <div className="alert info small"><b>Your reply:</b> {f.adminReply}</div>}
          <div className="row">
            <input style={{ flex: 1, minWidth: 200 }} placeholder="Write a reply…" aria-label="Reply" value={reply[f._id] || ''} onChange={(e) => setReply({ ...reply, [f._id]: e.target.value })} />
            <button className="btn sm" disabled={!reply[f._id]} onClick={() => { update(f, { adminReply: reply[f._id], status: 'in_progress' }); setReply({ ...reply, [f._id]: '' }); }}>Reply</button>
            {f.status !== 'resolved' && <button className="btn ok sm" onClick={() => update(f, { status: 'resolved' })}>Mark resolved</button>}
          </div>
        </div>
      ))}
    </>
  );
}
