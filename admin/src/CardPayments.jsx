import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { DELIVERY, formatDate, formatTime, money } from './labels';

// Chek rasmi Authorization sarlavhasi bilan olinadi (manzilda token bo'lmasin)
function Receipt({ id, uploaded }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uploaded) return undefined;
    let alive = true;
    let objectUrl = null;
    api
      .cardReceipt(id)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, uploaded]);

  if (!uploaded) return <div className="receipt receipt-empty">Chek hali yuklanmagan</div>;
  if (failed) return <div className="receipt receipt-empty">Chekni ochib bo‘lmadi</div>;
  if (!url) return <div className="receipt receipt-empty">Yuklanmoqda...</div>;
  return (
    <a className="receipt" href={url} target="_blank" rel="noreferrer" title="Kattalashtirish">
      <img src={url} alt="To‘lov cheki" />
    </a>
  );
}

/**
 * Karta orqali to'lovlar. Admin bank ilovasida kartaga pul tushganini tekshiradi va tasdiqlaydi.
 * Tasdiqlangandagina buyurtma "To'langan" bo'lib Buyurtmalar ro'yxatiga tushadi.
 * version - server yangi chek yoki qaror haqida xabar berganda oshadi (App.jsx).
 */
export default function CardPayments({ notify, version, onCount }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.cardPayments();
      setList(data);
      onCount(data.length);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [onCount]);

  useEffect(() => {
    load();
  }, [load, version]);

  const decide = async (p, ok) => {
    const question = ok
      ? `Kartaga ${money(p.amount)} tushganini bank ilovasida tekshirdingizmi?\nTasdiqlansa buyurtma "To‘langan" bo‘lib qabul qilinadi.`
      : `To‘lovni rad etasizmi?\nMijozga "kartaga pul tushmadi" degan xabar boradi, buyurtma qabul qilinmaydi.`;
    if (!window.confirm(question)) return;
    setBusy(p.id);
    try {
      const r = ok ? await api.confirmCard(p.id) : await api.rejectCard(p.id);
      notify(ok ? `Tasdiqlandi: buyurtma #${r.orderId}` : 'To‘lov rad etildi');
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Karta to‘lovlari</h2>
          <p className="muted">
            Kartaga pul tushganini bank ilovasida tekshirib, keyin tasdiqlang. Tasdiqlangan to‘lov buyurtmaga aylanadi.
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {list === null && !error && <p className="muted pad">Yuklanmoqda...</p>}
      {list && list.length === 0 && <p className="muted pad">Tekshirilishi kerak bo‘lgan to‘lovlar yo‘q</p>}

      {list && list.length > 0 && (
        <div className="pay-grid">
          {list.map((p) => (
            <article key={p.id} className="pay-card">
              <Receipt key={p.receiptAt || 'none'} id={p.id} uploaded={Boolean(p.receiptAt)} />
              <div className="pay-info">
                <div className="pay-sum">{money(p.amount)}</div>
                <div className="muted small">
                  {formatDate(p.createdAt)} {formatTime(p.createdAt)}
                  {p.receiptAt ? ` · chek ${formatTime(p.receiptAt)}` : ''}
                </div>
                <div className="strong">{[p.user.firstName, p.user.lastName].filter(Boolean).join(' ')}</div>
                {p.user.username && <div className="muted small">@{p.user.username}</div>}
                <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>{p.phone}</a>
                <div className="small">
                  {DELIVERY[p.deliveryType]}
                  {p.branch ? `: ${p.branch}` : ''}
                </div>
                {p.address && <div className="muted small addr">{p.address}</div>}
                <ul className="items small">
                  {p.items.map((i) => (
                    <li key={i.productId}>
                      {i.name} <span className="muted">× {i.qty}</span>
                    </li>
                  ))}
                </ul>
                <div className="pay-actions">
                  <button className="btn small primary" disabled={busy === p.id} onClick={() => decide(p, true)}>
                    ✅ Pul tushdi
                  </button>
                  <button className="btn small danger" disabled={busy === p.id} onClick={() => decide(p, false)}>
                    ❌ Pul tushmadi
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
