export const tg = window.Telegram?.WebApp || null;
export const initData = tg?.initData || '';

export function haptic(kind = 'light') {
  try {
    tg?.HapticFeedback?.impactOccurred(kind);
  } catch {
    /* eski versiyalarda yo'q */
  }
}
