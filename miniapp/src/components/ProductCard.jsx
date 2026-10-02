import { useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { CATEGORY_EMOJI } from '../i18n';
import { haptic } from '../tg';

export function ProductImage({ product, className = '' }) {
  const [failed, setFailed] = useState(false);
  const showImage = product.imageUrl && !failed;
  return (
    <div className={`pimg ${className}`}>
      {showImage ? (
        <img src={product.imageUrl} alt={product.name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="pimg-emoji" aria-hidden="true">
          {CATEGORY_EMOJI[product.category] || '🍽️'}
        </span>
      )}
    </div>
  );
}

export function Stepper({ qty, onChange, compact = false }) {
  return (
    <div className={`stepper ${compact ? 'compact' : ''}`}>
      <button onClick={() => { haptic(); onChange(qty - 1); }} aria-label="-">
        <Icon name="minus" size={18} />
      </button>
      <span>{qty}</span>
      <button onClick={() => { haptic(); onChange(qty + 1); }} aria-label="+">
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

export default function ProductCard({ product }) {
  const { cart, setQty, formatMoney } = useApp();
  const qty = cart[product.id] || 0;
  return (
    <article className="pcard">
      <ProductImage product={product} />
      <div className="pcard-body">
        <h3>{product.name}</h3>
        {product.description ? <p className="pdesc">{product.description}</p> : null}
        <div className="pcard-foot">
          <span className="price">{formatMoney(product.price)}</span>
          {qty === 0 ? (
            <button className="add-btn" onClick={() => { haptic(); setQty(product.id, 1); }} aria-label="+">
              <Icon name="plus" size={20} />
            </button>
          ) : (
            <Stepper qty={qty} onChange={(q) => setQty(product.id, q)} compact />
          )}
        </div>
      </div>
    </article>
  );
}
