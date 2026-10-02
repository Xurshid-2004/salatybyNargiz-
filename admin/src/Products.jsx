import { useEffect, useState } from 'react';
import { api } from './api';
import { CATEGORIES, categoryEmoji, categoryLabel, money } from './labels';

const EMPTY = { name: '', description: '', price: '', imageUrl: '', category: 'SALADS', isActive: true };

function Thumb({ product, size = 44 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.imageUrl]);
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {product.imageUrl && !failed ? (
        <img src={product.imageUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{categoryEmoji(product.category)}</span>
      )}
    </span>
  );
}

function ProductForm({ initial, onClose, onSaved, notify }) {
  const [form, setForm] = useState(
    initial ? { ...initial, price: String(initial.price) } : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload(file);
      set('imageUrl', url);
    } catch (err) {
      notify(err.message, true);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const price = Number(form.price);
    if (!Number.isInteger(price) || price < 0) return notify("Narx butun son bo'lishi kerak", true);
    setBusy(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        price,
        imageUrl: form.imageUrl,
        category: form.category,
        isActive: form.isActive,
      };
      if (initial) await api.updateProduct(initial.id, body);
      else await api.createProduct(body);
      notify(initial ? 'Mahsulot yangilandi' : "Mahsulot qo'shildi");
      onSaved();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h3>{initial ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h3>

        <label className="field">
          <span>Nomi</span>
          <input value={form.name} maxLength={80} required autoFocus onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>Ta’rifi</span>
          <textarea rows={2} value={form.description} maxLength={300} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="row">
          <label className="field">
            <span>Narxi (so‘m)</span>
            <input type="number" min="0" step="1" required value={form.price} onChange={(e) => set('price', e.target.value)} />
          </label>
          <label className="field">
            <span>Kategoriya</span>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span>Rasm</span>
          <div className="image-row">
            <Thumb product={form} size={64} />
            <div className="image-inputs">
              <label className="btn small ghost file">
                {uploading ? 'Yuklanmoqda...' : 'Rasm yuklash'}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
              </label>
              <input
                placeholder="yoki rasm havolasi (https://...)"
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
              />
            </div>
          </div>
        </div>

        <label className="check">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <span>Menyuda ko‘rinsin</span>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Bekor qilish</button>
          <button className="btn primary" disabled={busy || uploading}>Saqlash</button>
        </div>
      </form>
    </div>
  );
}

export default function Products({ notify }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | product

  const load = async () => {
    try {
      setProducts(await api.products());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const remove = async (p) => {
    if (!window.confirm(`"${p.name}" mahsulotini o'chirasizmi?`)) return;
    try {
      await api.deleteProduct(p.id);
      notify("Mahsulot o'chirildi");
      load();
    } catch (err) {
      notify(err.message, true);
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Mahsulotlar</h2>
          <p className="muted">{products ? `${products.length} ta mahsulot` : ''}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>+ Yangi mahsulot</button>
      </div>

      {error && <p className="error">{error}</p>}
      {products === null && !error && <p className="muted pad">Yuklanmoqda...</p>}

      {products && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rasm</th>
                <th>Nomi</th>
                <th>Kategoriya</th>
                <th className="num">Narxi</th>
                <th>Holati</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><Thumb product={p} /></td>
                  <td>
                    <div className="strong">{p.name}</div>
                    {p.description && <div className="muted small clamp">{p.description}</div>}
                  </td>
                  <td>{categoryLabel(p.category)}</td>
                  <td className="num strong nowrap">{money(p.price)}</td>
                  <td>
                    <span className={`badge ${p.isActive ? 'green' : 'gray'}`}>{p.isActive ? 'Faol' : 'Yashirin'}</span>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn small ghost" onClick={() => setEditing(p)}>Tahrirlash</button>
                      <button className="btn small danger" onClick={() => remove(p)}>O‘chirish</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductForm
          initial={editing === 'new' ? null : editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}
