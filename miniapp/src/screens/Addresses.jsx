import { useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { TopBar, BackButton } from '../components/TopBar';

export default function Addresses() {
  const { t, user, updateProfile, showToast, setAddressId } = useApp();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [busy, setBusy] = useState(false);

  const attach = () => {
    if (!navigator.geolocation) return showToast(t('location_failed'));
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => showToast(t('location_failed')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const add = async () => {
    if (address.trim().length < 5) return showToast(t('fill_address'));
    setBusy(true);
    try {
      const entry = {
        id: Date.now().toString(36),
        title: title.trim(),
        address: address.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      };
      await updateProfile({ addresses: [...user.addresses, entry].slice(-10) });
      setAddressId(entry.id);
      setTitle('');
      setAddress('');
      setCoords(null);
      showToast(t('saved'));
    } catch (err) {
      showToast(err.message || t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await updateProfile({ addresses: user.addresses.filter((a) => a.id !== id) });
    } catch (err) {
      showToast(err.message || t('error_generic'));
    }
  };

  return (
    <div className="screen">
      <TopBar left={<BackButton />} title={t('addresses_title')} />

      <section className="panel">
        <div className="fields">
          <label className="field">
            <span>{t('address_title_ph')}</span>
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('address')}</span>
            <textarea rows={2} value={address} maxLength={300} placeholder={t('address_ph')} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <button className={`btn btn-soft ${coords ? 'done' : ''}`} onClick={attach}>
            <Icon name={coords ? 'check' : 'target'} size={18} />
            {coords ? t('location_attached') : t('use_location')}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={add}>{t('add_address')}</button>
        </div>
      </section>

      {user.addresses.length === 0 ? (
        <div className="empty small">
          <span className="empty-emoji">📍</span>
          <h2>{t('addresses_empty')}</h2>
          <p>{t('addresses_empty_sub')}</p>
        </div>
      ) : (
        <section className="panel">
          {user.addresses.map((a) => (
            <div key={a.id} className="line">
              <span className="line-icon"><Icon name="pin" /></span>
              <div className="line-info">
                <strong>{a.title || a.address}</strong>
                {a.title ? <span className="muted">{a.address}</span> : null}
              </div>
              <button className="icon-btn danger" onClick={() => remove(a.id)} aria-label={t('delete')}>
                <Icon name="trash" size={20} />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
