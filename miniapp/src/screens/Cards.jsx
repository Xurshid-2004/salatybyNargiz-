import { Icon } from '../icons';
import { useApp } from '../store';
import { TopBar, BackButton } from '../components/TopBar';

export default function Cards() {
  const { t } = useApp();
  return (
    <div className="screen">
      <TopBar left={<BackButton />} title={t('cards_title')} />
      <div className="empty">
        <span className="empty-badge"><Icon name="card" size={30} /></span>
        <h2>{t('cards_empty')}</h2>
        <p>{t('cards_empty_sub')}</p>
      </div>
    </div>
  );
}
