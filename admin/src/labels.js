export const CATEGORIES = [
  { value: 'SALADS', label: 'Salatlar', emoji: '🥗' },
  { value: 'SAMSA', label: 'Somsalar', emoji: '🥟' },
  { value: 'DRINKS', label: 'Ichimliklar', emoji: '🥤' },
  { value: 'COMPOT', label: 'Kompot', emoji: '🍹' },
  { value: 'SAUCES', label: 'Yangi souslar', emoji: '🍅' },
];
export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;
export const categoryEmoji = (v) => CATEGORIES.find((c) => c.value === v)?.emoji || '🍽️';

export const DELIVERY = { DELIVERY: 'Yetkazib berish', PICKUP: 'Olib ketish' };
export const PAYMENT_METHOD = { CASH: 'Naqd', CLICK: 'Click', PAYME: 'Payme' };
export const PAYMENT_STATUS = { PAID: "To'langan", UNPAID: "To'lanmagan", REFUNDED: 'Qaytarilgan' };
export const ORDER_STATUS = { PENDING: 'Kutilmoqda', DELIVERED: 'Yetkazildi', CANCELLED: 'Bekor qilingan' };

export const money = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;

const pad = (n) => String(n).padStart(2, '0');
export const formatDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
export const formatTime = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
