import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import { tg } from '../tg';
import { TopBar, BackButton } from '../components/TopBar';

const POLL_MS = 3000;

// To'lov sahifasini tashqi brauzerda (yoki Payme/Click ilovasida) ochish
function openPage(url) {
  try {
    if (tg?.openLink) return tg.openLink(url);
  } catch {
    /* eski versiya */
  }
  window.open(url, '_blank', 'noopener');
}

export default function Pay() {
  const { t, screen, formatMoney, clearCart, reset, back, showToast } = useApp();
  const { payment } = screen.params;
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState('PENDING'); // PENDING | EXPIRED | CANCELLED
  const name = payment.provider === 'CLICK' ? 'Click' : 'Payme';

  const done = useCallback(
    (orderId) => {
      clearCart();
      reset('success', { orderId });
    },
    [clearCart, reset],
  );

  // Haqiqiy to'lov: Payme/Click serverimizga tasdiq yuborgach buyurtma paydo bo'ladi - shuni kutamiz
  useEffect(() => {
    if (!payment.payUrl || state === 'CANCELLED') return undefined;
    let stopped = false;
    const check = async () => {
      try {
        const res = await api.payment(payment.id);
        if (stopped) return;
        if (res.status === 'PAID') done(res.orderId);
        else if (res.status === 'CANCELLED') setState('CANCELLED');
        else if (res.expired) setState('EXPIRED');
      } catch {
        /* tarmoq xatosi: keyingi urinishda tekshiriladi */
      }
    };
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [payment.id, payment.payUrl, state, done]);

  const confirmTest = async () => {
    setBusy(true);
    try {
      const res = await api.confirmTestPayment(payment.id);
      done(res.orderId);
    } catch (err) {
      showToast(err.message || t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (payment.testMode) {
    body = (
      <>
        <p className="note">{t('pay_test_note')}</p>
        <button className="btn btn-primary" disabled={busy} onClick={confirmTest}>
          {t('pay_confirm')}
        </button>
      </>
    );
  } else if (!payment.payUrl) {
    body = <p className="note">{t('pay_unavailable')}</p>;
  } else if (state === 'PENDING') {
    body = (
      <>
        <p className="muted">{t('pay_waiting').replace('{provider}', name)}</p>
        <button className="btn btn-primary" onClick={() => openPage(payment.payUrl)}>
          {t('pay_open').replace('{provider}', name)}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="note">{t(state === 'EXPIRED' ? 'pay_expired' : 'pay_cancelled')}</p>
        <button className="btn btn-primary" onClick={back}>{t('pay_reorder')}</button>
      </>
    );
  }

  return (
    <div className="screen">
      <TopBar left={<BackButton />} title={t('pay_title')} />
      <section className="panel pay">
        <span className={`provider provider-${payment.provider.toLowerCase()}`}>{name}</span>
        <p className="muted">{t('pay_amount')}</p>
        <p className="pay-amount">{formatMoney(payment.amount)}</p>
        {body}
      </section>
    </div>
  );
}
