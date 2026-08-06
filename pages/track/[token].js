import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Header, StatusRail, PodBlock } from '../../components/Shared';

export default function TrackOrder() {
  const router = useRouter();
  const { token } = router.query;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    fetch(`/api/track/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setOrder(data.order);
        } else {
          setError(data.error || 'No delivery found for that tracking code.');
          setOrder(null);
        }
      })
      .catch(() => setError('Network error looking up this delivery.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="wb-shell">
      <Header active="client" />

      {loading && <div className="wb-card wb-empty">Looking up your delivery&hellip;</div>}

      {!loading && error && (
        <div className="wb-card">
          <div className="wb-banner error">{error}</div>
          <div className="wb-note">Check the tracking code and try again from the Client Tracking tab.</div>
        </div>
      )}

      {!loading && order && (
        <div className="wb-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ marginBottom: 2 }}>{order.facility}</h2>
              <div className="wb-oid">{order.id}</div>
            </div>
            <span className={`wb-badge ${order.status}`}>{order.status.replace('_', ' ')}</span>
          </div>
          <hr className="wb-hr" />
          <div className="wb-grid">
            <div>
              <label>Delivery address</label>
              <div style={{ fontSize: 14 }}>{order.address}</div>
            </div>
            <div>
              <label>Items</label>
              <div style={{ fontSize: 14 }}>{order.items || '\u2014'}</div>
            </div>
          </div>

          <StatusRail order={order} />

          {order.status === 'completed' ? (
            <PodBlock order={order} />
          ) : (
            <div className="wb-note">
              We&rsquo;ll email {order.contactEmail} the moment this delivery is verified complete, with proof of
              delivery attached.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
