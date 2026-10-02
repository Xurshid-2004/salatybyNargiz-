import { Icon } from '../icons';
import { useApp } from '../store';

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

// Har bir ekranning yuqori paneli. O'ng burchakda doim Dark/Light tugmasi turadi.
/** @param {{ left?: any, center?: any, title?: any }} props */
export function TopBar({ left, center, title }) {
  return (
    <header className="topbar">
      <div className="topbar-left">{left}</div>
      <div className="topbar-center">{center ?? (title ? <h1 className="topbar-title">{title}</h1> : null)}</div>
      <div className="topbar-right">
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
