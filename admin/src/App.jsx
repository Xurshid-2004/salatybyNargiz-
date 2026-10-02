import { useCallback, useEffect, useRef, useState } from 'react';
import { clearToken, getToken, setUnauthorizedHandler } from './api';
import Login from './Login';
import Orders from './Orders';
import Products from './Products';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState('orders');
  const [toast, setToast] = useState(null);
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
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Mahsulotlar</button>
        </nav>
        <button className="logout" onClick={logout}>Chiqish</button>
      </aside>

      <main className="content">
        {tab === 'orders' ? <Orders notify={notify} /> : <Products notify={notify} />}
      </main>

      {toast && <div className={`toast ${toast.isError ? 'bad' : ''}`}>{toast.message}</div>}
    </div>
  );
}
