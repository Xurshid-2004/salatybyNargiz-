import { Icon } from '../icons';
import { useApp } from '../store';

// Yuqoridagi manzil / filial tugmasi bosilganda ochiladigan pastki oyna
export default function AddressSheet({ open, onClose }) {
  const { t, user, config, orderType, setOrderType, addressId, setAddressId, branchId, setBranchId, go } = useApp();
  const addresses = user?.addresses || [];

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <div className={`sheet ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="sheet-grip" />
        <div className="seg">
          <button className={orderType === 'DELIVERY' ? 'active' : ''} onClick={() => setOrderType('DELIVERY')}>
            {t('delivery')}
          </button>
          <button className={orderType === 'PICKUP' ? 'active' : ''} onClick={() => setOrderType('PICKUP')}>
            {t('pickup')}
          </button>
        </div>

        {orderType === 'DELIVERY' ? (
          <div className="sheet-list">
            {addresses.length === 0 && <p className="muted center">{t('no_saved_addresses')}</p>}
            {addresses.map((a) => (
              <button
                key={a.id}
                className={`radio-row ${addressId === a.id ? 'active' : ''}`}
                onClick={() => { setAddressId(a.id); onClose(); }}
              >
                <Icon name="pin" />
                <span>
                  <strong>{a.title || a.address}</strong>
                  {a.title ? <small>{a.address}</small> : null}
                </span>
                {addressId === a.id && <Icon name="check" className="tick" />}
              </button>
            ))}
            <button className="btn btn-soft" onClick={() => { onClose(); go('addresses'); }}>
              <Icon name="plus" size={18} /> {t('add_address')}
            </button>
          </div>
        ) : (
          <div className="sheet-list">
            {(config?.branches || []).map((b) => (
              <button
                key={b.id}
                className={`radio-row ${branchId === b.id ? 'active' : ''}`}
                onClick={() => { setBranchId(b.id); onClose(); }}
              >
                <Icon name="bag" />
                <span>
                  <strong>{b.name}</strong>
                  <small>{b.address}</small>
                </span>
                {branchId === b.id && <Icon name="check" className="tick" />}
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-primary" onClick={onClose}>{t('done')}</button>
      </div>
    </>
  );
}
