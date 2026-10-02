import { useCallback, useEffect, useRef, useState } from 'react';
import { api, streamUrl } from './api';
import { DELIVERY, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, formatDate, formatTime, money } from './labels';

const FILTERS = [
  { value: '', label: 'Barchasi' },
  { value: 'PENDING', label: 'Kutilmoqda' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
];

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    /* ovoz ixtiyoriy */
  }
}

export default function Orders({ notify }) {
  const [filter, setFilter] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [fresh, setFresh] = useState(new Set());
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const load = useCallback(async () => {
    try {
      setOrders(await api.orders(filterRef.current));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    setOrders(null);
    load();
  }, [filter, load]);

  // Real vaqt: server yangi buyurtma haqida xabar beradi (SSE)
  useEffect(() => {
    const es = new EventSource(streamUrl());
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener('order:new', (e) => {
      const { id } = JSON.parse(e.data);
      setFresh((cur) => new Set(cur).add(id));
      notify(`Yangi buyurtma #${id}`);
      beep();
      load();
    });
    es.addEventListener('order:update', load);
    return () => es.close();
  }, [load, notify]);

  // Zaxira: ulanish uzilib qolsa ham ro'yxat yangilanib turadi
  useEffect(() => {
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const patch = async (id, body) => {
    try {
      await api.updateOrder(id, body);
      setFresh((cur) => {
        const next = new Set(cur);
        next.delete(id);
        return next;
      });
      load();
    } catch (err) {
      notify(err.message, true);
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Buyurtmalar</h2>
          <p className="muted">
            <span className={`dot ${live ? 'on' : ''}`} /> {live ? 'Jonli: yangi buyurtmalar o‘zi paydo bo‘ladi' : 'Ulanmoqda...'}
          </p>
        </div>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {orders === null && !error && <p className="muted pad">Yuklanmoqda...</p>}
      {orders && orders.length === 0 && <p className="muted pad">Buyurtmalar yo‘q</p>}

      {orders && orders.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Sana</th>
                <th>Mijoz</th>
                <th>Telefon</th>
                <th>Turi</th>
                <th>To‘lov</th>
                <th>Buyurtma</th>
                <th className="num">Jami</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={fresh.has(o.id) ? 'fresh' : ''}>
                  <td className="strong">#{o.id}</td>
                  <td className="nowrap">
                    <div>{formatDate(o.createdAt)}</div>
                    <div className="muted small">{formatTime(o.createdAt)}</div>
                  </td>
                  <td>
                    <div className="strong">{[o.user.firstName, o.user.lastName].filter(Boolean).join(' ')}</div>
                    {o.user.username && <div className="muted small">@{o.user.username}</div>}
                  </td>
                  <td className="nowrap">
                    <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`}>{o.phone}</a>
                  </td>
                  <td className="type-cell">
                    <div>{DELIVERY[o.deliveryType]}</div>
                    {o.address && <div className="muted small addr">{o.address}</div>}
                    {o.branch && <div className="muted small">{o.branch}</div>}
                    {o.latitude != null && (
                      <a className="small" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}>
                        Xaritada ko‘rish
                      </a>
                    )}
                  </td>
                  <td>
                    <div>{PAYMENT_METHOD[o.paymentMethod]}</div>
                    <span className={`badge ${o.paymentStatus === 'PAID' ? 'green' : o.paymentStatus === 'REFUNDED' ? 'red' : 'amber'}`}>
                      {PAYMENT_STATUS[o.paymentStatus]}
                    </span>
                  </td>
                  <td>
                    <ul className="items">
                      {o.items.map((i) => (
                        <li key={i.productId}>
                          {i.name} <span className="muted">× {i.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="num strong nowrap">{money(o.total)}</td>
                  <td className="status-cell">
                    <span className={`badge ${o.status === 'DELIVERED' ? 'green' : o.status === 'CANCELLED' ? 'red' : 'amber'}`}>
                      {ORDER_STATUS[o.status]}
                    </span>
                    <div className="actions">
                    {o.status === 'PENDING' && (
                      <>
                        <button className="btn small primary" onClick={() => patch(o.id, { status: 'DELIVERED' })}>
                          Yetkazildi
                        </button>
                        <button
                          className="btn small ghost"
                          onClick={() =>
                            window.confirm(
                              o.paymentMethod !== 'CASH' && o.paymentStatus === 'PAID'
                                ? `#${o.id} buyurtma ${PAYMENT_METHOD[o.paymentMethod]} orqali to'langan. Bekor qilsangiz, pulni ${PAYMENT_METHOD[o.paymentMethod]} kabinetidan mijozga o'zingiz qaytarishingiz kerak. Bekor qilasizmi?`
                                : `#${o.id} buyurtmani bekor qilasizmi?`,
                            ) && patch(o.id, { status: 'CANCELLED' })
                          }
                        >
                          Bekor qilish
                        </button>
                      </>
                    )}
                    {o.status !== 'PENDING' && o.paymentStatus !== 'REFUNDED' && (
                      <button className="btn small ghost" onClick={() => patch(o.id, { status: 'PENDING' })}>
                        Kutilmoqdaga qaytarish
                      </button>
                    )}
                    {o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED' && (
                      <button className="btn small ghost" onClick={() => patch(o.id, { paymentStatus: 'PAID' })}>
                        To‘landi
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
