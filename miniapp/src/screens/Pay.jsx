import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { useApp } from '../store';
import { tg, hapticResult } from '../tg';
import { TopBar, BackButton } from '../components/TopBar';
import { compressReceipt, MAX_IMAGE_BYTES } from '../image';

const POLL_MS = 3000;
// Karta orqali to'lovda admin qarori bir necha daqiqa olishi mumkin - kamroq so'raymiz
const CARD_POLL_MS = 6000;
const PROVIDER_NAME = { CLICK: 'Click', PAYME: 'Payme' };

// To'lov sahifasini tashqi brauzerda (yoki Payme/Click ilovasida) ochish
function openPage(url) {
  try {
    if (tg?.openLink) return tg.openLink(url);
  } catch {
    /* eski versiya */
  }
  window.open(url, '_blank', 'noopener');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* ba'zi Telegram ilovalarida clipboard yopiq - eski usul */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
}

const formatCard = (n) => n.replace(/(\d{4})(?=\d)/g, '$1 ');

function CopyRow({ label, value, display }) {
  const { t, showToast } = useApp();
  const copy = async () => {
    if (await copyText(value)) {
      hapticResult('success');
      showToast(t('card_copied'));
    }
  };
  return (
    <div className="copy-row">
      <span>
        <small>{label}</small>
        <strong>{display}</strong>
      </span>
      <button className="copy-btn" onClick={copy}>
        <Icon name="copy" size={16} />
        {t('card_copy')}
      </button>
    </div>
  );
}

/** Karta orqali oldindan to'lov: mijoz kartaga o'tkazadi va chekni yuklaydi, admin tasdiqlaydi */
function CardTransfer({ payment, receiptUploaded, onUploaded }) {
  const { t, formatMoney, showToast } = useApp();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const { card } = payment;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressReceipt(file).catch(() => null);
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error(t('card_file_error'));
      await api.uploadReceipt(payment.id, blob);
      hapticResult('success');
      onUploaded();
    } catch (err) {
      hapticResult('error');
      showToast(err.message || t('error_generic'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card-transfer">
      {receiptUploaded ? <p className="note info">{t('card_review')}</p> : null}
      <ol className="steps">
        <li>
          <p>{t('card_step1')}</p>
          <CopyRow label={t('card_number')} value={card.number} display={formatCard(card.number)} />
          {card.holder ? <p className="muted small-text">{t('card_holder')}: {card.holder}</p> : null}
          <CopyRow label={t('pay_amount')} value={String(payment.amount)} display={formatMoney(payment.amount)} />
        </li>
        <li>
          <p>{t('card_step2')}</p>
          <button className="btn btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={20} />
            {uploading ? t('card_uploading') : receiptUploaded ? t('card_replace') : t('card_upload')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </li>
      </ol>
      <p className="reg-privacy">
        <Icon name="lock" size={14} />
        {t('card_note')}
      </p>
    </div>
  );
}

export default function Pay() {
  const { t, screen, formatMoney, clearCart, reset, back, showToast } = useApp();
  const { payment } = screen.params;
  const isCard = payment.provider === 'CARD';
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState('PENDING'); // PENDING | EXPIRED | CANCELLED
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const name = isCard ? t('card_provider') : PROVIDER_NAME[payment.provider] || payment.provider;

  const done = useCallback(
    (orderId) => {
      clearCart();
      reset('success', { orderId });
    },
    [clearCart, reset],
  );

  // To'lov tasdig'ini kutamiz: Payme/Click serverimizga xabar beradi, karta to'lovini esa admin tasdiqlaydi
  const watching = Boolean(payment.payUrl || isCard) && state === 'PENDING';
  useEffect(() => {
    if (!watching) return undefined;
    let stopped = false;
    const check = async () => {
      try {
        const res = await api.payment(payment.id);
        if (stopped) return;
        if (res.status === 'PAID') done(res.orderId);
        else if (res.status === 'CANCELLED') setState('CANCELLED');
        else if (res.expired) setState('EXPIRED');
        else if (res.receiptUploaded) setReceiptUploaded(true);
      } catch {
        /* tarmoq xatosi: keyingi urinishda tekshiriladi */
      }
    };
    const timer = window.setInterval(check, isCard ? CARD_POLL_MS : POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [payment.id, watching, isCard, done]);

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

  // Chek yuborildi: buyurtma endi admin qarorini kutadi, savat bo'shatiladi (qayta buyurtma bo'lib ketmasin)
  const onReceiptUploaded = () => {
    setReceiptUploaded(true);
    clearCart();
  };

  let body;
  if (isCard && state === 'PENDING') {
    body = (
      <>
        <CardTransfer payment={payment} receiptUploaded={receiptUploaded} onUploaded={onReceiptUploaded} />
        {receiptUploaded ? (
          <button className="btn btn-soft" onClick={() => reset('home')}>{t('to_menu')}</button>
        ) : null}
      </>
    );
  } else if (payment.testMode) {
    body = (
      <>
        <p className="note">{t('pay_test_note')}</p>
        <button className="btn btn-primary" disabled={busy} onClick={confirmTest}>
          {t('pay_confirm')}
        </button>
      </>
    );
  } else if (!payment.payUrl && !isCard) {
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
    const message = state === 'EXPIRED' ? 'pay_expired' : isCard ? 'card_rejected' : 'pay_cancelled';
    body = (
      <>
        <p className="note">{t(message)}</p>
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
