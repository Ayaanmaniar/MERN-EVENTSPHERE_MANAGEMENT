import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import api, { errMsg } from '../api/client';
import { Alert, Field } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const u = await login(f.email, f.password);
      nav(homeFor(u.role));
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap card">
      <h1>Welcome back</h1>
      <p className="muted">Log in to manage expos, booths and sessions.</p>
      <Alert>{err}</Alert>
      <form onSubmit={submit}>
        <Field label="Email"><input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="small"><Link to="/forgot-password">Forgot password?</Link> · New here? <Link to="/register">Create an account</Link></p>
      <div className="alert info small">
        Demo: admin@eventsphere.com / Admin@123 · tech@eventsphere.com / Exhibitor@123 · ali@eventsphere.com / Attendee@123
      </div>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'attendee', companyName: '', phone: '', consent: false, marketing: false });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const u = await register(f);
      nav(homeFor(u.role));
    } catch (e2) { setErr(errMsg(e2)); }
  };
  return (
    <div className="auth-wrap card">
      <h1>Create account</h1>
      <Alert>{err}</Alert>
      <form onSubmit={submit}>
        <Field label="I am a…">
          <select value={f.role} onChange={set('role')}>
            <option value="attendee">Attendee / Visitor</option>
            <option value="exhibitor">Exhibitor</option>
          </select>
        </Field>
        <Field label="Full name"><input required value={f.name} onChange={set('name')} /></Field>
        {f.role === 'exhibitor' && <Field label="Company name"><input required value={f.companyName} onChange={set('companyName')} /></Field>}
        <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone (optional)"><input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Password" hint="At least 8 characters, with a letter and a number."><input type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <div className="field"><label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} required /> I agree to the Terms and consent to my data being processed to run the events I register for (required).</label></div>
        <div className="field"><label className="check"><input type="checkbox" checked={f.marketing} onChange={set('marketing')} /> Send me news about future events (optional).</label></div>
        <button className="btn" style={{ width: '100%' }}>Sign up</button>
      </form>
      <p className="small">Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const { data } = await api.post('/auth/forgot-password', { email }); setMsg(data); } catch (e2) { setErr(errMsg(e2)); }
  };
  return (
    <div className="auth-wrap card">
      <h1>Forgot password</h1>
      <Alert>{err}</Alert>
      {msg ? (
        <>
          <Alert type="ok">{msg.message}</Alert>
          {msg.devResetLink && <Alert type="info">Development mode (no SMTP configured): <a href={msg.devResetLink.replace(/^https?:\/\/[^/]+/, '')}>open reset link</a></Alert>}
        </>
      ) : (
        <form onSubmit={submit}>
          <Field label="Your account email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn">Send reset link</button>
        </form>
      )}
      <p className="small"><Link to="/login">Back to login</Link></p>
    </div>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.post(`/auth/reset-password/${token}`, { password: pw }); setOk(true); setTimeout(() => nav('/login'), 1500); } catch (e2) { setErr(errMsg(e2)); }
  };
  return (
    <div className="auth-wrap card">
      <h1>Choose a new password</h1>
      <Alert>{err}</Alert>
      <Alert type="ok">{ok && 'Password updated. Redirecting to login…'}</Alert>
      <form onSubmit={submit}>
        <Field label="New password" hint="At least 8 characters"><input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <button className="btn">Reset password</button>
      </form>
    </div>
  );
}
