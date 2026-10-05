import { Icon } from '../icons';
import { useApp } from '../store';
import { tg } from '../tg';

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      className="icon-btn"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

// Admin Panel shu serverning /admin/ manzilida, parol bilan himoyalangan.
// Telegram'ning o'z brauzerida ochiladi, Mini App esa orqada ochiq qoladi.
const ADMIN_URL = new URL('/admin/', window.location.origin).href;

export function AdminButton() {
  const openAdmin = () => {
    if (tg?.openLink) tg.openLink(ADMIN_URL);
    else window.open(ADMIN_URL, '_blank', 'noopener');
  };
  return (
    <button className="admin-btn" onClick={openAdmin}>
      <Icon name="lock" size={18} />
      <span>Admin</span>
    </button>
  );
}

// Har bir ekranning yuqori paneli. O'ng burchakda doim Dark/Light tugmasi turadi.
/** @param {{ left?: any, center?: any, title?: any, right?: any }} props */
export function TopBar({ left, center, title, right }) {
  return (
    <header className="topbar">
      <div className="topbar-left">{left}</div>
      <div className="topbar-center">{center ?? (title ? <h1 className="topbar-title">{title}</h1> : null)}</div>
      <div className="topbar-right">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}

export function BackButton() {
  const { back } = useApp();
  return (
    <button className="icon-btn" onClick={back} aria-label="Back">
      <Icon name="back" />
    </button>
  );
}
