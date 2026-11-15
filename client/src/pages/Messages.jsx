import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import useLive from '../api/useLive';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { Empty, fmtDateTime } from '../components/ui';

export default function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(params.get('to'));
  const [thread, setThread] = useState({ user: null, messages: [] });
  const [text, setText] = useState('');
  const [admins, setAdmins] = useState([]);
  const end = useRef();

  const loadConvs = useCallback(() => api.get('/messages/conversations').then((r) => setConvs(r.data.conversations)), []);
  const loadThread = useCallback((id) => api.get(`/messages/thread/${id}`).then((r) => { setThread(r.data); loadConvs(); }).catch((e) => toast(errMsg(e), 'error')), [loadConvs]);

  useEffect(() => { loadConvs(); api.get('/messages/admins').then((r) => setAdmins(r.data.admins)); }, []);
  useEffect(() => { if (active) loadThread(active); }, [active]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.messages.length]);

  useLive(null, { 'message:new': (m) => { if (String(m.from) === String(active)) loadThread(active); else loadConvs(); } });

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api.post('/messages', { to: active, text }); setText(''); loadThread(active); } catch (e2) { toast(errMsg(e2), 'error'); }
  };

  return (
    <>
      <div className="page-head"><h1>Messages</h1>
        {user.role !== 'admin' && admins[0] && <button className="btn ghost" onClick={() => setActive(admins[0]._id)}>Contact organizers / support</button>}
      </div>
      <div className="chat">
        <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 520 }}>
          {!convs.length && !active && <Empty>No conversations yet.<br />Open an exhibitor profile and click “Chat”.</Empty>}
          {convs.map((c) => (
            <button key={c.user._id} className={`conv ${active === c.user._id ? 'active' : ''}`} onClick={() => setActive(c.user._id)}>
              <span><b>{c.user.name}</b><br /><span className="small muted">{c.lastMessage.slice(0, 40)}</span></span>
              {c.unread > 0 && <span className="badge" style={{ position: 'static' }}>{c.unread}</span>}
            </button>
          ))}
        </div>
        <div className="card thread">
          {!active ? <Empty>Select a conversation</Empty> : (
            <>
              <div><b>{thread.user?.name}</b> <span className="muted small">({thread.user?.role})</span><hr /></div>
              <div className="msgs" aria-live="polite">
                {thread.messages.map((m) => (
                  <div key={m._id} className={`bubble ${String(m.from) === String(user._id) ? 'me' : ''}`}>{m.text}<time>{fmtDateTime(m.createdAt)}</time></div>
                ))}
                <div ref={end} />
              </div>
              <form className="row" onSubmit={send}>
                <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label="Message" maxLength={2000} />
                <button className="btn">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
