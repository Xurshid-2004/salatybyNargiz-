import { Icon } from '../icons';
import { useApp } from '../store';
import { tg } from '../tg';
import { ThemeToggle } from '../components/TopBar';

export default function Success() {
  const { t, screen, reset } = useApp();
  const { orderId } = screen.params;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-left" />
        <div className="topbar-center" />
        <div className="topbar-right"><ThemeToggle /></div>
      </header>
      <div className="empty success">
        <span className="success-badge"><Icon name="check" size={36} /></span>
        <h2>{t('success_title')}</h2>
        {orderId ? <p className="order-no">{t('order_number')} №{orderId}</p> : null}
        <p>{t('success_sub')}</p>
        <div className="stack">
          <button className="btn btn-primary" onClick={() => { reset('home'); }}>{t('to_menu')}</button>
          <button className="btn btn-soft" onClick={() => reset('orders')}>{t('my_orders')}</button>
          {tg?.close ? <button className="btn btn-ghost" onClick={() => tg.close()}>{t('close')}</button> : null}
        </div>
      </div>
    </div>
  );
}
