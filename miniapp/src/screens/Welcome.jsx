import { Icon } from '../icons';
import { useApp } from '../store';
import { TopBar } from '../components/TopBar';
import { Avatar } from '../components/Drawer';
import { formatNumber } from '../i18n';

export default function Welcome() {
  const { t, user, setOrderType, reset } = useApp();

  const choose = (type) => {
    setOrderType(type);
    reset('home');
  };

  return (
    <div className="screen">
      <TopBar
        left={
          <div className="profile-chip">
            <Avatar size={40} />
            <div>
              <strong>{user.firstName}</strong>
              <span>
                <Icon name="star" size={13} /> {t('bonuses')}: {formatNumber(user.bonus)}
              </span>
            </div>
          </div>
        }
      />

      <main className="welcome">
        <div className="brand">
          <h1 className="wordmark">
            Salaty
            <br />
            By Nargiz
          </h1>
          <p className="hours">
            <span className="hours-badge">{t('hours')}</span>
            {t('open_always')}
          </p>
        </div>

        <h2 className="welcome-q">{t('choose_type')}</h2>
        <div className="choices">
          <button className="choice" onClick={() => choose('DELIVERY')}>
            <span className="choice-icon"><Icon name="van" size={26} /></span>
            <span className="choice-text">
              <strong>{t('delivery')}</strong>
              <small>{t('delivery_sub')}</small>
            </span>
            <Icon name="right" className="chev" />
          </button>
          <button className="choice" onClick={() => choose('PICKUP')}>
            <span className="choice-icon"><Icon name="bag" size={26} /></span>
            <span className="choice-text">
              <strong>{t('pickup')}</strong>
              <small>{t('pickup_sub')}</small>
            </span>
            <Icon name="right" className="chev" />
          </button>
        </div>
      </main>
    </div>
  );
}
