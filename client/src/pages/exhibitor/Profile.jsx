import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/Toast';
import { Field, Loading } from '../../components/ui';

export default function ExhibitorProfile() {
  const toast = useToast();
  const [p, setP] = useState(null);
  const [logo, setLogo] = useState(null);
  useEffect(() => { api.get('/exhibitors/me/profile').then((r) => setP({ ...r.data.profile, products: (r.data.profile.products || []).join(', ') })); }, []);
  if (!p) return <Loading />;
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    ['companyName', 'category', 'description', 'products', 'website', 'contactEmail', 'contactPhone', 'address'].forEach((k) => fd.append(k, p[k] ?? ''));
    if (logo) fd.append('logo', logo);
    try { const { data } = await api.put('/exhibitors/me/profile', fd); setP({ ...data.profile, products: data.profile.products.join(', ') }); setLogo(null); toast('Profile saved', 'success'); } catch (e2) { toast(errMsg(e2), 'error'); }
  };
  return (
    <>
      <div className="page-head"><h1>Company profile</h1><span className="muted small">Visible to attendees who browse exhibitors.</span></div>
      <form className="card" onSubmit={save}>
        <div className="row" style={{ marginBottom: 14 }}>
          {p.logo ? <img className="logo" style={{ width: 80, height: 80 }} src={p.logo} alt="Company logo" /> : <div className="logo" style={{ width: 80, height: 80 }}>{p.companyName?.[0]}</div>}
          <Field label="Logo (png/jpg, max 5MB)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files[0])} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Company name"><input required value={p.companyName} onChange={set('companyName')} /></Field>
          <Field label="Category"><input value={p.category} onChange={set('category')} placeholder="e.g. Technology" /></Field>
          <Field label="Website"><input type="url" value={p.website} onChange={set('website')} placeholder="https://" /></Field>
          <Field label="Contact email"><input type="email" value={p.contactEmail} onChange={set('contactEmail')} /></Field>
          <Field label="Contact phone"><input value={p.contactPhone} onChange={set('contactPhone')} /></Field>
          <Field label="Address"><input value={p.address} onChange={set('address')} /></Field>
        </div>
        <Field label="Description"><textarea value={p.description} onChange={set('description')} /></Field>
        <Field label="Products / services" hint="Separate with commas"><input value={p.products} onChange={set('products')} /></Field>
        <button className="btn">Save profile</button>
      </form>
    </>
  );
}
