import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import useLive from '../api/useLive';
import { Alert, Empty, Field, Loading, Tag, fmtDateTime } from '../components/ui';
import Schedule from '../components/Schedule';

export function Notifications() {
  const [items, setItems] = useState(null);
  const nav = useNavigate();
  const load = () => api.get('/notifications').then((r) => setItems(r.data.notifications));
  useEffect(() => { load(); }, []);
  useLive(null, { 'notification:new': load });
  if (!items) return <Loading />;
  return (
    <>
      <div className="page-head"><h1>Notifications</h1><button className="btn ghost" onClick={() => api.put('/notifications/read-all').then(load)}>Mark all read</button></div>
      <div className="card" style={{ padding: 0 }}>
        {!items.length && <Empty>You're all caught up.</Empty>}
        {items.map((n) => (
          <div key={n._id} className={`notif ${n.read ? '' : 'unread'}`} style={{ cursor: n.link ? 'pointer' : 'default' }}
            onClick={() => { api.put(`/notifications/${n._id}/read`); if (n.link) nav(n.link); else load(); }}>
            <b>{n.title}</b><div className="small">{n.body}</div><div className="small muted">{fmtDateTime(n.createdAt)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function FeedbackPage() {
  const toast = useToast();
  const [f, setF] = useState({ type: 'suggestion', subject: '', message: '', rating: '' });
  const [mine, setMine] = useState([]);
  const load = () => api.get('/feedback/mine').then((r) => setMine(r.data.feedback));
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/feedback', { ...f, rating: f.rating || undefined }); toast('Thanks for your feedback!', 'success'); setF({ type: 'suggestion', subject: '', message: '', rating: '' }); load(); } catch (e2) { toast(errMsg(e2), 'error'); }
  };
  return (
    <>
      <div className="page-head"><h1>Feedback & support</h1></div>
      <div className="grid c2">
        <form className="card" onSubmit={submit}>
          <h2>Send us a message</h2>
          <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="suggestion">Suggestion</option><option value="issue">Report an issue</option><option value="other">Other</option></select></Field>
          <Field label="Subject"><input required maxLength={150} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Details"><textarea required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
          <Field label="Rate your experience (optional)"><select value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}><option value="">–</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></Field>
          <button className="btn">Submit</button>
        </form>
        <div className="card">
          <h2>Your previous feedback</h2>
          {!mine.length && <Empty>Nothing submitted yet.</Empty>}
          {mine.map((m) => (
            <div key={m._id} className="notif">
              <div className="row between"><b>{m.subject}</b><Tag>{m.status}</Tag></div>
              <div className="small">{m.message}</div>
              {m.adminReply && <div className="alert info small" style={{ marginTop: 6 }}><b>Reply:</b> {m.adminReply}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Account() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [delPw, setDelPw] = useState('');
  const [p, setP] = useState({ name: user.name, phone: user.phone || '', marketing: !!user.consent?.marketing });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [err, setErr] = useState('');
  const save = async (e) => { e.preventDefault(); try { const { data } = await api.put('/auth/me', p); setUser(data.user); toast('Profile saved', 'success'); } catch (e2) { toast(errMsg(e2), 'error'); } };
  const change = async (e) => { e.preventDefault(); setErr(''); try { await api.put('/auth/change-password', pw); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed', 'success'); } catch (e2) { setErr(errMsg(e2)); } };
  const exportData = async () => {
    const { data } = await api.get('/auth/me/export', { responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = 'my-eventsphere-data.json'; a.click();
  };
  const deleteAccount = async (e) => {
    e.preventDefault();
    if (!confirm('This permanently deletes your account and data. Continue?')) return;
    try { await api.delete('/auth/me', { data: { password: delPw } }); logout(); nav('/'); toast('Account deleted', 'success'); } catch (e2) { toast(errMsg(e2), 'error'); }
  };
  return (
    <div className="grid c2">
      <form className="card" onSubmit={save}>
        <h2>My account</h2>
        <Field label="Email"><input value={user.email} disabled /></Field>
        <Field label="Name"><input value={p.name} required onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Phone"><input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
        <div className="field"><label className="check"><input type="checkbox" checked={p.marketing} onChange={(e) => setP({ ...p, marketing: e.target.checked })} /> I want to receive news about future events (you can change this any time).</label></div>
        <button className="btn">Save</button>
      </form>
      <form className="card" onSubmit={change}>
        <h2>Change password</h2>
        <Alert>{err}</Alert>
        <Field label="Current password"><input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="New password"><input type="password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        <button className="btn">Update password</button>
      </form>
      <div className="card stack">
        <h2>Your data & privacy</h2>
        <p className="small muted">You control your data: download a copy of everything we store, or delete your account.</p>
        <button type="button" className="btn ghost" onClick={exportData}>⬇ Download my data (JSON)</button>
      </div>
      <form className="card" onSubmit={deleteAccount}>
        <h2>Delete account</h2>
        <Field label="Confirm with your password"><input type="password" required value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" /></Field>
        <button className="btn danger">Delete my account</button>
      </form>
    </div>
  );
}

export function MySchedule() {
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const load = () => api.get('/sessions/mine').then((r) => setSessions(r.data.sessions));
  useEffect(() => { load(); }, []);
  useLive(null, { 'schedule:changed': load });
  const toggle = (kind) => async (s) => { try { await api.post(`/sessions/${s._id}/${kind}`); load(); } catch (e) { toast(errMsg(e), 'error'); } };
  if (!sessions) return <Loading />;
  return (
    <>
      <div className="page-head"><h1>My schedule</h1><span className="muted small">You get a reminder 15 minutes before each session.</span></div>
      <div className="card">
        {!sessions.length ? <Empty>You haven't registered or bookmarked sessions. <Link to="/">Browse expos</Link></Empty> : <Schedule sessions={sessions} onRegister={toggle('register')} onBookmark={toggle('bookmark')} />}
      </div>
    </>
  );
}

export const NotFound = () => <Empty><h1>404</h1>Page not found. <Link to="/">Go home</Link></Empty>;
