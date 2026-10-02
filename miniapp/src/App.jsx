import { useApp } from './store';
import { initData, tg } from './tg';
import { ThemeToggle } from './components/TopBar';
import Welcome from './screens/Welcome';
import Home from './screens/Home';
import Cart from './screens/Cart';
import Pay from './screens/Pay';
import Success from './screens/Success';
import Orders from './screens/Orders';
import Cards from './screens/Cards';
import Addresses from './screens/Addresses';

const SCREENS = {
  welcome: Welcome,
  home: Home,
  cart: Cart,
  pay: Pay,
  success: Success,
  orders: Orders,
  cards: Cards,
  addresses: Addresses,
};

function Message({ title, text, action }) {
  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-left" />
        <div className="topbar-center" />
        <div className="topbar-right"><ThemeToggle /></div>
      </header>
      <div className="empty">
        <span className="empty-emoji">🥗</span>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
        {action}
      </div>
    </div>
  );
}

export default function App() {
  const { t, loading, loadError, load, screen, toast } = useApp();

  // Ilova Telegram tashqarisida ochilgan bo'lsa - so'rovlar baribir rad etiladi
  if (!initData) {
    return <Message title={t('not_in_telegram')} text={t('not_in_telegram_sub')} />;
  }
  if (loading) return <Message title={t('loading')} />;
  if (loadError) {
    return (
      <Message
        title={t('error_generic')}
        text={loadError}
        action={<button className="btn btn-primary" onClick={load}>{t('retry')}</button>}
      />
    );
  }

  const Screen = SCREENS[screen.name] || Home;
  return (
    <>
      <Screen />
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </>
  );
}

// Telegram'ga ilova tayyorligini bildirish
try {
  tg?.ready();
  tg?.expand();
  tg?.disableVerticalSwipes?.();
} catch {
  /* eski versiya */
}
