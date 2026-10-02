const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.2A8 8 0 019.8 4 8 8 0 1020 14.2z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.6-4.6',
  pin: 'M12 21s7-6.1 7-11.5a7 7 0 10-14 0C5 14.9 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  chevron: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  bag: 'M6 8h12l1 12H5L6 8zM9 8V6.5a3 3 0 016 0V8',
  van: 'M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM17 18.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z',
  history: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M7 15h3',
  globe: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  target: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
};

export function Icon({ name, size = 22, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
