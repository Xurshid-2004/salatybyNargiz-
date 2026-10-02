import { useMemo, useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { CATEGORIES, CATEGORY_EMOJI } from '../i18n';
import { TopBar } from '../components/TopBar';
import ProductCard from '../components/ProductCard';
import Drawer from '../components/Drawer';
import AddressSheet from '../components/AddressSheet';

export default function Home() {
  const { t, products, user, config, orderType, addressId, branchId, cartCount, cartTotal, formatMoney, go } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(null);

  const address = user.addresses.find((a) => a.id === addressId);
  const branch = config.branches.find((b) => b.id === branchId);
  const pillLabel =
    orderType === 'DELIVERY'
      ? address
        ? address.title || address.address
        : t('choose_address')
      : branch?.name || t('branch');
  const pillCaption = orderType === 'DELIVERY' ? t('delivery_to') : t('pickup_at');

  const groups = useMemo(
    () => CATEGORIES.map((c) => ({ c, list: products.filter((p) => p.category === c) })).filter((g) => g.list.length),
    [products],
  );

  const q = query.trim().toLowerCase();
  const searchResults = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : null;
  const visibleGroups = cat ? groups.filter((g) => g.c === cat) : groups;

  return (
    <div className="screen has-cartbar">
      <TopBar
        left={
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Menu">
            <Icon name="menu" />
          </button>
        }
        center={
          <button className="addr-pill" onClick={() => setSheet(true)}>
            <Icon name="pin" size={18} />
            <span className="addr-text">
              <small>{pillCaption}</small>
              <strong>{pillLabel}</strong>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        }
      />

      <label className="searchbar">
        <Icon name="search" size={20} />
        <input
          type="search"
          value={query}
          placeholder={t('search')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {!q && (
        <div className="cats" role="tablist">
          <button className={`cat ${cat === null ? 'active' : ''}`} onClick={() => setCat(null)}>
            <span className="cat-tile"><Icon name="menu" size={26} /></span>
            <span className="cat-name">{t('all')}</span>
          </button>
          {groups.map(({ c }) => (
            <button key={c} className={`cat ${cat === c ? 'active' : ''}`} onClick={() => setCat(cat === c ? null : c)}>
              <span className="cat-tile">{CATEGORY_EMOJI[c]}</span>
              <span className="cat-name">{t(`cat_${c}`)}</span>
            </button>
          ))}
        </div>
      )}

      {searchResults ? (
        searchResults.length ? (
          <div className="grid">
            {searchResults.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="empty-note">{t('nothing_found')}</p>
        )
      ) : (
        visibleGroups.map(({ c, list }) => (
          <section key={c} className="section">
            <h2>{t(`cat_${c}`)}</h2>
            <div className="grid">
              {list.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        ))
      )}

      {cartCount > 0 && (
        <div className="cartbar-wrap">
          <button className="cartbar" onClick={() => go('cart')}>
            <span className="cartbar-count">{cartCount}</span>
            <span className="cartbar-label">{t('view_cart')}</span>
            <span className="cartbar-total">{formatMoney(cartTotal)}</span>
          </button>
        </div>
      )}

      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <AddressSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
