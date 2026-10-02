import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import { TopBar, BackButton } from '../components/TopBar';

export default function Orders() {
  const { t, formatMoney, lang } = useApp();
  const [tab, setTab] = useState('active');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setOrders(null);
    setError('');
    api
      .orders(tab === 'active')
      .then((o) => alive && setOrders(o))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [tab]);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString(lang === 'uz' ? 'uz-UZ' : lang === 'en' ? 'en-GB' : 'ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="screen">
      <TopBar left={<BackButton />} title={t('orders_title')} />
      <div className="seg tabs">
        <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>{t('orders_active')}</button>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>{t('orders_all')}</button>
      </div>

      {error && <p className="empty-note">{error}</p>}
      {!error && orders === null && <p className="empty-note">{t('loading')}</p>}
      {orders && orders.length === 0 && (
        <div className="empty small">
          <span className="empty-emoji">🧾</span>
          <h2>{t('orders_empty')}</h2>
          <p>{t('orders_empty_sub')}</p>
        </div>
      )}
      {orders?.map((o) => (
        <article key={o.id} className="panel order">
          <div className="order-head">
            <div>
              <strong>№{o.id}</strong>
              <span className="muted"> {fmtDate(o.createdAt)}</span>
            </div>
            <span className={`status status-${o.status.toLowerCase()}`}>{t(`status_${o.status}`)}</span>
          </div>
          <ul className="order-items">
            {o.items.map((i) => (
              <li key={i.productId}>
                <span>{i.name} × {i.qty}</span>
                <span className="muted">{formatMoney(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="order-foot">
            <span className={`status ${{ PAID: 'status-delivered', REFUNDED: 'status-cancelled' }[o.paymentStatus] || 'status-pending'}`}>
              {o.paymentMethod === 'CASH' ? t('pay_cash') : o.paymentMethod === 'CLICK' ? 'Click' : 'Payme'}
              {' - '}
              {t({ PAID: 'paid', REFUNDED: 'refunded' }[o.paymentStatus] || 'unpaid')}
            </span>
            <strong>{formatMoney(o.total)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
