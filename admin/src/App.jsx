import { useCallback, useEffect, useRef, useState } from 'react';
import { api, clearToken, getToken, setUnauthorizedHandler, streamUrl } from './api';
import Login from './Login';
import Orders from './Orders';
import Products from './Products';
import CardPayments from './CardPayments';

function beep() {
  try {
    const ctx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* ovoz ixtiyoriy */
  }
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState('orders');
  const [toast, setToast] = useState(null);
  const [cardCount, setCardCount] = useState(0);
  const [cardVersion, setCardVersion] = useState(0);
  const timer = useRef(null);

  const logout = useCallback(() => {
    clearToken();
    setAuthed(false);
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const notify = useCallback((message, isError = false) => {
    setToast({ message, isError });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // Karta to'lovlari: qaysi sahifada turmasin, yangi chek kelsa ovoz va xabar chiqadi
  useEffect(() => {
    if (!authed) return undefined;
    let alive = true;
    const refresh = () => {
      setCardVersion((v) => v + 1);
      api.cardPayments().then((list) => alive && setCardCount(list.length)).catch(() => {});
    };
    refresh();
    const es = new EventSource(streamUrl());
    es.addEventListener('payment:new', () => {
      notify("Yangi karta to'lovi: chekni tekshiring");
      beep();
      refresh();
    });
    es.addEventListener('payment:update', refresh);
    const interval = setInterval(refresh, 30000);
    return () => {
      alive = false;
      es.close();
      clearInterval(interval);
    };
  }, [authed, notify]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="layout">
      <aside className="side">
        <div className="brand">
          Salaty
          <br />
          By Nargiz
        </div>
        <nav>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Buyurtmalar</button>
          <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>
            Karta to‘lovlari
            {cardCount > 0 && <span className="count">{cardCount}</span>}
          </button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Mahsulotlar</button>
        </nav>
        <button className="logout" onClick={logout}>Chiqish</button>
      </aside>

      <main className="content">
        {tab === 'orders' && <Orders notify={notify} />}
        {tab === 'cards' && <CardPayments notify={notify} version={cardVersion} onCount={setCardCount} />}
        {tab === 'products' && <Products notify={notify} />}
      </main>

      {toast && <div className={`toast ${toast.isError ? 'bad' : ''}`}>{toast.message}</div>}
    </div>
  );
}
