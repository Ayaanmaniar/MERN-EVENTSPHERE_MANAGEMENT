import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import api from '../api/client';
import useLive from '../api/useLive';

const links = {
  guest: [['/', 'Expos'], ['/exhibitors', 'Exhibitors']],
  attendee: [['/', 'Expos'], ['/exhibitors', 'Exhibitors'], ['/my-schedule', 'My Schedule'], ['/messages', 'Messages'], ['/feedback', 'Feedback']],
  exhibitor: [['/exhibitor/profile', 'Company Profile'], ['/exhibitor/applications', 'Applications'], ['/exhibitor/booth', 'My Booth'], ['/', 'Expos'], ['/exhibitors', 'Exhibitors'], ['/messages', 'Messages'], ['/feedback', 'Feedback']],
  admin: [['/admin', 'Dashboard'], ['/admin/expos', 'Expos'], ['/admin/applications', 'Applications'], ['/admin/reports', 'Reports'], ['/messages', 'Messages'], ['/admin/feedback', 'Feedback']],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);

  const refresh = () => {
    if (!user) return;
    api.get('/notifications').then((r) => setUnread(r.data.unread)).catch(() => {});
    api.get('/messages/unread-count').then((r) => setMsgUnread(r.data.count)).catch(() => {});
  };
  useEffect(refresh, [user]);

  useLive(null, {
    'notification:new': (n) => {
      toast(n.title, 'info');
      refresh();
    },
    'message:new': () => {
      toast('New message received', 'info');
      refresh();
    },
  });

  const items = links[user ? user.role : 'guest'];
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand">Event<span>Sphere</span></Link>
          <nav className="nav-links" aria-label="Main">
            {items.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/' || to === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}{label === 'Messages' && msgUnread > 0 ? ` (${msgUnread})` : ''}
              </NavLink>
            ))}
          </nav>
          <div className="nav-right">
            {user ? (
              <>
                <button className="icon-btn" onClick={() => nav('/notifications')} aria-label={`Notifications, ${unread} unread`}>
                  🔔{unread > 0 && <span className="badge">{unread}</span>}
                </button>
                <Link to="/account" style={{ color: '#fff', fontSize: '.9rem' }}>{user.name.split(' ')[0]} <span className="tag" style={{ marginLeft: 4 }}>{user.role === 'admin' ? 'organizer' : user.role}</span></Link>
                <button className="btn ghost sm" style={{ color: '#fff', borderColor: '#4b5a8a' }} onClick={() => { logout(); nav('/login'); }}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" style={{ color: '#fff' }}>Login</Link>
                <Link to="/register" className="btn sm">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="container"><Outlet /></main>
      <footer className="footer">© {new Date().getFullYear()} EventSphere Management · Your data is handled per our privacy policy.</footer>
    </>
  );
}
