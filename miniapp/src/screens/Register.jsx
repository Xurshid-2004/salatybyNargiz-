import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { useApp } from '../store';
import { TopBar } from '../components/TopBar';
import { LANGS } from '../i18n';
import { tg, canRequestContact, requestContact, hapticResult } from '../tg';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Raqam bot chati orqali kelgan bo'lsa, server uni tasdiqlaguncha /me ni tekshirib turamiz
async function waitForPhone(tries, delayMs, isActive) {
  for (let i = 0; i < tries && isActive(); i += 1) {
    try {
      const u = await api.me();
      if (u.phoneVerified) return u;
    } catch {
      /* tarmoq xatosi - keyingi urinishda */
    }
    await sleep(delayMs);
  }
  return null;
}

/**
 * Ro'yxatdan o'tish: mijoz telefon raqamini Telegram orqali yuboradi.
 * Raqamni Telegram o'zi tasdiqlaydi, SMS kod kerak emas.
 * step: idle | checking | denied | failed | chat
 */
export default function Register() {
  const { t, lang, changeLang, setUser, showToast } = useApp();
  const [step, setStep] = useState('idle');

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const isMounted = () => mounted.current;

  const finish = (u) => {
    hapticResult('success');
    showToast(t('reg_done'));
    setUser(u);
  };

  // Zaxira yo'l: bot chatga "Raqamni yuborish" tugmasini yuboradi
  const askInChat = async () => {
    setStep('checking');
    try {
      await api.requestContactInChat();
      setStep('chat');
    } catch (err) {
      setStep('failed');
      showToast(err.message || t('error_generic'));
    }
  };

  // Mijoz raqamni chatdagi tugma orqali yuborguncha kutamiz (ilova ochiq tursa, o'zi davom etadi)
  useEffect(() => {
    if (step !== 'chat') return undefined;
    let active = true;
    waitForPhone(120, 2500, () => active && isMounted()).then((u) => {
      if (u && active) finish(u);
    });
    return () => {
      active = false;
    };
  }, [step]);

  const share = async () => {
    if (!canRequestContact()) return askInChat();

    let result;
    try {
      result = await requestContact();
    } catch {
      return setStep('failed');
    }
    if (!result.shared) {
      hapticResult('warning');
      return setStep('denied');
    }

    setStep('checking');
    let u = null;
    if (result.response) {
      try {
        u = await api.verifyContact(result.response);
      } catch {
        /* raqam bot orqali ham keladi - pastda tekshiramiz */
      }
    }
    if (!u?.phoneVerified) u = await waitForPhone(8, 1500, isMounted);
    if (!isMounted()) return;
    if (u?.phoneVerified) return finish(u);
    hapticResult('error');
    setStep('failed');
  };

  const busy = step === 'checking';

  return (
    <div className="screen">
      <TopBar
        left={
          <div className="seg lang-mini" role="group" aria-label={t('menu_language')}>
            {LANGS.map((l) => (
              <button key={l.code} className={lang === l.code ? 'active' : ''} onClick={() => changeLang(l.code)}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      <main className="welcome register">
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

        <section className="reg-card">
          <span className="choice-icon"><Icon name="phone" size={26} /></span>
          <h2>{t('reg_title')}</h2>
          <p className="muted">{t('reg_sub')}</p>

          {step === 'denied' && <p className="note">{t('reg_denied')}</p>}
          {step === 'failed' && <p className="note">{t('reg_failed')}</p>}
          {step === 'chat' && <p className="note info">{t('reg_chat_sent')}</p>}

          {step === 'chat' && tg?.close ? (
            <button className="btn btn-primary" onClick={() => tg.close()}>{t('reg_open_chat')}</button>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={share}>
              <Icon name="phone" size={20} />
              {busy ? t('reg_checking') : t('reg_share')}
            </button>
          )}
          {(step === 'failed' || step === 'denied') && canRequestContact() && (
            <button className="btn btn-ghost" onClick={askInChat}>{t('reg_via_chat')}</button>
          )}

          <p className="reg-privacy">
            <Icon name="lock" size={14} />
            {t('reg_privacy')}
          </p>
        </section>
      </main>
    </div>
  );
}
