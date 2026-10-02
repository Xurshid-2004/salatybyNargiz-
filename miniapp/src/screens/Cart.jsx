import { useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { useApp } from '../store';
import { TopBar, BackButton } from '../components/TopBar';
import { ProductImage, Stepper } from '../components/ProductCard';
import { formatPhone } from '../i18n';

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export default function Cart() {
  const {
    t, user, config, cartItems, cartTotal, formatMoney, setQty, clearCart,
    orderType, setOrderType, addressId, setAddressId, branchId, setBranchId,
    updateProfile, showToast, go, reset, load,
  } = useApp();

  const selected = user.addresses.find((a) => a.id === addressId);
  const [address, setAddress] = useState(selected?.address || '');
  const [coords, setCoords] = useState(
    selected?.latitude != null ? { lat: selected.latitude, lng: selected.longitude } : null,
  );
  const [method, setMethod] = useState('CASH');
  const [saveAddr, setSaveAddr] = useState(false);
  const [busy, setBusy] = useState(false);

  const online = method !== 'CASH';

  const pickSaved = (a) => {
    setAddressId(a.id);
    setAddress(a.address);
    setCoords(a.latitude != null ? { lat: a.latitude, lng: a.longitude } : null);
  };

  const attachLocation = async () => {
    try {
      setCoords(await getLocation());
    } catch {
      showToast(t('location_failed'));
    }
  };

  const submit = async () => {
    if (orderType === 'DELIVERY' && address.trim().length < 5) return showToast(t('fill_address'));

    setBusy(true);
    try {
      const res = await api.createOrder({
        items: cartItems.map((i) => ({ productId: i.id, qty: i.qty })),
        deliveryType: orderType,
        address: address.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        branchId,
        paymentMethod: method,
      });

      // Manzilni saqlash (xohlasa) - buyurtmaga xalaqit bermasligi uchun xatoliklar e'tiborsiz
      if (saveAddr && orderType === 'DELIVERY' && !user.addresses.some((a) => a.address === address.trim())) {
        const addresses = [
          ...user.addresses,
          { id: Date.now().toString(36), title: '', address: address.trim(), latitude: coords?.lat ?? null, longitude: coords?.lng ?? null },
        ].slice(-10);
        updateProfile({ addresses }).catch(() => {});
      }

      if (res.order) {
        clearCart();
        reset('success', { orderId: res.order.id });
      } else {
        go('pay', { payment: res.payment });
      }
    } catch (err) {
      showToast(err.message || t('error_generic'));
      // Raqam tasdig'i bekor qilingan bo'lsa - profilni yangilaymiz, ilova ro'yxatdan o'tishga qaytadi
      if (err.code === 'PHONE_REQUIRED') load();
    } finally {
      setBusy(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="screen">
        <TopBar left={<BackButton />} title={t('cart')} />
        <div className="empty">
          <span className="empty-emoji">🛒</span>
          <h2>{t('cart_empty')}</h2>
          <p>{t('cart_empty_sub')}</p>
          <button className="btn btn-primary" onClick={() => reset('home')}>{t('to_menu')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen has-cartbar">
      <TopBar left={<BackButton />} title={t('cart')} />

      <section className="panel">
        {cartItems.map((item) => (
          <div key={item.id} className="line">
            <ProductImage product={item} className="thumb" />
            <div className="line-info">
              <strong>{item.name}</strong>
              <span className="muted">{formatMoney(item.price)}</span>
            </div>
            <Stepper qty={item.qty} onChange={(q) => setQty(item.id, q)} compact />
          </div>
        ))}
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('order_type')}</h3>
        <div className="seg">
          <button className={orderType === 'DELIVERY' ? 'active' : ''} onClick={() => setOrderType('DELIVERY')}>
            {t('delivery')}
          </button>
          <button className={orderType === 'PICKUP' ? 'active' : ''} onClick={() => setOrderType('PICKUP')}>
            {t('pickup')}
          </button>
        </div>

        {orderType === 'DELIVERY' ? (
          <div className="fields">
            {user.addresses.length > 0 && (
              <div className="chips">
                {user.addresses.map((a) => (
                  <button key={a.id} className={`chip ${addressId === a.id ? 'active' : ''}`} onClick={() => pickSaved(a)}>
                    {a.title || a.address}
                  </button>
                ))}
              </div>
            )}
            <label className="field">
              <span>{t('address')}</span>
              <textarea
                rows={2}
                value={address}
                placeholder={t('address_ph')}
                maxLength={300}
                onChange={(e) => { setAddress(e.target.value); setAddressId(null); }}
              />
            </label>
            <button className={`btn btn-soft ${coords ? 'done' : ''}`} onClick={attachLocation}>
              <Icon name={coords ? 'check' : 'target'} size={18} />
              {coords ? t('location_attached') : t('use_location')}
            </button>
            <label className="check">
              <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} />
              <span>{t('save_address')}</span>
            </label>
          </div>
        ) : (
          <div className="fields">
            {config.branches.map((b) => (
              <button
                key={b.id}
                className={`radio-row ${branchId === b.id ? 'active' : ''}`}
                onClick={() => setBranchId(b.id)}
              >
                <Icon name="bag" />
                <span><strong>{b.name}</strong><small>{b.address}</small></span>
                {branchId === b.id && <Icon name="check" className="tick" />}
              </button>
            ))}
          </div>
        )}

        <div className="info-row">
          <Icon name="phone" />
          <span>
            <small>{t('phone')}</small>
            <strong>{formatPhone(user.phone)}</strong>
          </span>
          <span className="verified"><Icon name="check" size={14} /> {t('verified')}</span>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">{t('payment')}</h3>
        <div className="fields">
          {[
            ['CASH', t('pay_cash'), t('pay_cash_sub')],
            ['CARD', t('pay_card'), t('pay_card_sub')],
            ['CLICK', t('pay_click'), t('pay_online_sub')],
            ['PAYME', t('pay_payme'), t('pay_online_sub')],
          ].filter(([code]) => config.paymentMethods.includes(code)).map(([code, title, sub]) => (
            <button key={code} className={`radio-row ${method === code ? 'active' : ''}`} onClick={() => setMethod(code)}>
              <Icon name={code === 'CASH' ? 'bag' : 'card'} />
              <span><strong>{title}</strong><small>{sub}</small></span>
              {method === code && <Icon name="check" className="tick" />}
            </button>
          ))}
        </div>
      </section>

      <div className="cartbar-wrap">
        <button className="cartbar submit" disabled={busy} onClick={submit}>
          <span className="cartbar-label">{online ? t('pay_and_order') : t('place_order')}</span>
          <span className="cartbar-total">{formatMoney(cartTotal)}</span>
        </button>
      </div>
    </div>
  );
}
