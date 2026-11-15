import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { Empty, Loading, Tag } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export function Exhibitors() {
  const [list, setList] = useState(null);
  const [cats, setCats] = useState([]);
  const [expos, setExpos] = useState([]);
  const [f, setF] = useState({ search: '', category: '', expo: '' });
  useEffect(() => {
    api.get('/exhibitors/categories').then((r) => setCats(r.data.categories));
    api.get('/expos').then((r) => setExpos(r.data.expos));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => api.get('/exhibitors', { params: f }).then((r) => setList(r.data.exhibitors)), 250);
    return () => clearTimeout(t);
  }, [f]);
  return (
    <>
      <div className="page-head"><h1>Find exhibitors</h1></div>
      <div className="card row" style={{ marginBottom: 16 }}>
        <input style={{ flex: 2, minWidth: 200 }} placeholder="Search by company, product or keyword…" aria-label="Search" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
        <select style={{ flex: 1, minWidth: 150 }} aria-label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select style={{ flex: 1, minWidth: 150 }} aria-label="Expo" value={f.expo} onChange={(e) => setF({ ...f, expo: e.target.value })}>
          <option value="">All expos</option>{expos.map((x) => <option key={x._id} value={x._id}>{x.title}</option>)}
        </select>
      </div>
      {!list ? <Loading /> : !list.length ? <Empty>No exhibitors match your search.</Empty> : (
        <div className="grid c3">
          {list.map((x) => (
            <Link key={x._id} to={`/exhibitors/${x.user}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row">{x.logo ? <img className="logo" src={x.logo} alt="" /> : <div className="logo">{x.companyName[0]}</div>}
                <div><b>{x.companyName}</b><div className="small muted">{x.category}</div></div></div>
              <p className="small">{(x.description || '').slice(0, 100)}</p>
              <div className="row">{(x.products || []).slice(0, 3).map((p) => <Tag key={p}>{p}</Tag>)}{x.booth && <Tag kind="ok">Booth {x.booth.code}</Tag>}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function ExhibitorDetail() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/exhibitors/${userId}`).then((r) => setD(r.data)).catch(() => setD(false)); }, [userId]);
  if (d === false) return <Empty>Exhibitor not found.</Empty>;
  if (!d) return <Loading />;
  const p = d.profile;
  return (
    <div className="card stack">
      <div className="row">{p.logo ? <img className="logo" style={{ width: 80, height: 80 }} src={p.logo} alt={`${p.companyName} logo`} /> : <div className="logo" style={{ width: 80, height: 80 }}>{p.companyName[0]}</div>}
        <div><h1 style={{ margin: 0 }}>{p.companyName}</h1><Tag>{p.category}</Tag></div></div>
      <p>{p.description || 'No description provided.'}</p>
      {p.products?.length > 0 && <div><b>Products & services</b><div className="row" style={{ marginTop: 6 }}>{p.products.map((x) => <Tag key={x}>{x}</Tag>)}</div></div>}
      <div className="small">
        {p.website && <div>🌐 <a href={p.website} target="_blank" rel="noreferrer noopener">{p.website}</a></div>}
        {p.contactEmail && <div>✉️ <a href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a></div>}
        {p.contactPhone && <div>📞 {p.contactPhone}</div>}
        {p.address && <div>🏢 {p.address}</div>}
      </div>
      {d.booths.length > 0 && <div><b>Booth locations</b>{d.booths.map((b) => <div key={b._id}><Link to={`/expos/${b.expo?._id}`}>{b.expo?.title}</Link> — booth <b>{b.code}</b></div>)}</div>}
      {user && String(user._id) !== String(userId) && <div className="row">
        <Link className="btn" to={`/messages?to=${userId}`}>💬 Chat with exhibitor</Link>
        {p.contactEmail && <a className="btn ghost" href={`mailto:${p.contactEmail}?subject=Appointment request`}>Request appointment by email</a>}
      </div>}
    </div>
  );
}
