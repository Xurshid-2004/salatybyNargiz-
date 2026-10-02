import { Icon } from '../icons';
import { useApp } from '../store';
import { LANGS, formatNumber, formatPhone } from '../i18n';
import { tg } from '../tg';

export function Avatar({ size = 44 }) {
  const { user } = useApp();
  const photo = tg?.initDataUnsafe?.user?.photo_url;
  const initial = (user?.firstName || '?').slice(0, 1).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {photo ? <img src={photo} alt="" /> : initial}
    </span>
  );
}

export default function Drawer({ open, onClose }) {
  const { t, user, lang, changeLang, go } = useApp();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  const open_ = (screen) => {
    onClose();
    go(screen);
  };

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <Avatar size={56} />
          <div className="drawer-user">
            <strong>{name}</strong>
            {user?.phone ? <span className="drawer-phone">{formatPhone(user.phone)}</span> : null}
            <span className="bonus-chip">
              <Icon name="star" size={14} /> {t('bonuses')}: {formatNumber(user?.bonus || 0)}
            </span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <nav className="drawer-menu">
          <button onClick={() => open_('orders')}>
            <Icon name="history" /> <span>{t('menu_history')}</span>
            <Icon name="right" size={18} className="chev" />
          </button>
          <button onClick={() => open_('cards')}>
            <Icon name="card" /> <span>{t('menu_cards')}</span>
            <Icon name="right" size={18} className="chev" />
          </button>
          <button onClick={() => open_('addresses')}>
            <Icon name="pin" /> <span>{t('menu_addresses')}</span>
            <Icon name="right" size={18} className="chev" />
          </button>
        </nav>

        <div className="drawer-lang">
          <div className="drawer-lang-title">
            <Icon name="globe" /> <span>{t('menu_language')}</span>
          </div>
          <div className="seg">
            {LANGS.map((l) => (
              <button key={l.code} className={lang === l.code ? 'active' : ''} onClick={() => changeLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
