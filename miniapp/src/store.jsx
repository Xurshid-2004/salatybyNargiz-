import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { makeT, formatNumber } from './i18n';
import { tg } from './tg';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const MAX_QTY = 50;
const THEME_COLORS = { light: '#F3F5F2', dark: '#0F1512' };

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem('cart') || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ru');
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || (tg?.colorScheme === 'dark' ? 'dark' : 'light'),
  );
  const [cart, setCart] = useState(readCart);
  const [orderType, setOrderType] = useState(null); // 'DELIVERY' | 'PICKUP'
  const [addressId, setAddressId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [toast, setToast] = useState('');

  const [stack, setStack] = useState([{ name: 'welcome', params: {} }]);
  const screen = stack[stack.length - 1];
  const go = useCallback((name, params = {}) => setStack((s) => [...s, { name, params }]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const reset = useCallback((name, params = {}) => setStack([{ name, params }]), []);

  const t = useMemo(() => makeT(lang), [lang]);
  const formatMoney = useCallback((n) => `${formatNumber(n)} ${t('currency')}`, [t]);

  // Mavzu
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    try {
      tg?.setHeaderColor?.(THEME_COLORS[theme]);
      tg?.setBackgroundColor?.(THEME_COLORS[theme]);
    } catch {
      /* eski versiya */
    }
  }, [theme, lang]);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = cur === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next); // tanlov saqlanib qoladi
      return next;
    });
  }, []);

  // Dastlabki yuklash
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [u, p, c] = await Promise.all([api.me(), api.products(), api.config()]);
      setUser(u);
      setProducts(p);
      setConfig(c);
      setBranchId((cur) => cur || c.branches[0]?.id || null);
      if (!localStorage.getItem('lang')) setLang(u.language || 'ru');
      // Menyudan olib tashlangan mahsulotlarni savatdan chiqarib tashlash
      const ids = new Set(p.map((x) => x.id));
      setCart((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => ids.has(Number(id)))));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Telegram "Orqaga" tugmasi
  useEffect(() => {
    const bb = tg?.BackButton;
    if (!bb) return undefined;
    const handler = () => back();
    bb.onClick(handler);
    return () => bb.offClick(handler);
  }, [back]);

  useEffect(() => {
    const bb = tg?.BackButton;
    if (!bb) return;
    if (stack.length > 1) bb.show();
    else bb.hide();
  }, [stack.length]);

  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const changeLang = useCallback(
    (code) => {
      setLang(code);
      localStorage.setItem('lang', code);
      api.updateMe({ language: code }).then(setUser).catch(() => {});
    },
    [],
  );

  const updateProfile = useCallback(async (patch) => {
    const u = await api.updateMe(patch);
    setUser(u);
    return u;
  }, []);

  // Savatcha
  const setQty = useCallback((id, qty) => {
    setCart((cur) => {
      const next = { ...cur };
      const q = Math.max(0, Math.min(MAX_QTY, qty));
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }, []);
  const clearCart = useCallback(() => setCart({}), []);

  const cartItems = useMemo(
    () => products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] })),
    [products, cart],
  );
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0);

  const value = {
    user, setUser, products, config, loading, loadError, load,
    lang, t, changeLang, formatMoney,
    theme, toggleTheme,
    cart, cartItems, cartCount, cartTotal, setQty, clearCart,
    orderType, setOrderType, addressId, setAddressId, branchId, setBranchId,
    updateProfile,
    screen, go, back, reset,
    toast, showToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
