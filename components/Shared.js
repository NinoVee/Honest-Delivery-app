import Link from 'next/link';

export function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Footer() {
  return <div className="wb-footer">Honest Care — Delivering With Trust.</div>;
}

export function Header({ active }) {
  return (
    <div className="wb-header-bar">
      <div className="wb-header-inner">
        <div className="wb-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Honest Care Medical Logistics" />
          <div className="wb-brandtext">
            <h1>Honest Care</h1>
            <span className="wb-tag">A secure way to log orders, with full transparency</span>
          </div>
        </div>
        <div className="wb-tabs">
          <Link href="/" className={`wb-tab ${active === 'client' ? 'active' : ''}`}>
            Client Tracking
          </Link>
          <Link href="/driver" className={`wb-tab ${active === 'driver' ? 'active' : ''}`}>
            Driver Console
          </Link>
        </div>
      </div>
    </div>
  );
}

export function StatusRail({ order }) {
  const steps = [
    { key: 'in_transit', label: 'In Transit' },
    { key: 'onsite', label: 'Onsite' },
    { key: 'completed', label: 'Completed' },
  ];
  const rank = { pending_review: -1, pending: -1, in_transit: 0, onsite: 1, completed: 2, cancelled: -1 };
  const currentRank = rank[order.status];
  return (
    <div className="wb-rail">
      {steps.map((s, i) => {
        const hist = (order.history || []).find((h) => h.status === s.key);
        const done = currentRank > i;
        const current = currentRank === i;
        return (
          <div key={s.key} className={`wb-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <div className="wb-seal">{done ? '\u2713' : i + 1}</div>
            <div className="wb-label">{s.label}</div>
            {hist && <div className="wb-time">{fmtTime(hist.timestamp)}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function PodBlock({ order }) {
  if (!order.pod) return null;
  return (
    <>
      {order.status === 'completed' && (
        <div className="wb-stampwrap">
          <div className="wb-stamp">
            Verified Delivery
            <span className="sub">{fmtTime(order.pod.completedAt)}</span>
          </div>
        </div>
      )}
      <hr className="wb-hr" />
      <h3>Proof of Delivery</h3>
      <div className="wb-grid">
        <div>
          <label>Recipient signature</label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.pod.signature}
            alt="Recipient signature"
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 3, background: '#fff' }}
          />
        </div>
        <div>
          <label>Delivery photos</label>
          <div className="wb-photo-grid">
            {(order.pod.photos || []).length === 0 && <span className="wb-note">No photos attached</span>}
            {(order.pod.photos || []).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} className="wb-photo-thumb" src={p} alt={`Delivery photo ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="wb-grid">
        <div>
          <label>Completed by</label>
          <div className="wb-mono" style={{ fontSize: 13 }}>{order.pod.driverName || '\u2014'}</div>
        </div>
        <div>
          <label>Timestamp</label>
          <div className="wb-mono" style={{ fontSize: 13 }}>{fmtTime(order.pod.completedAt)}</div>
        </div>
      </div>
      {order.pod.notes && (
        <>
          <label>Notes</label>
          <div className="wb-note">{order.pod.notes}</div>
        </>
      )}
    </>
  );
}

export function EmailStatus({ order }) {
  if (!order.emailLog || order.emailLog.length === 0) return null;
  return (
    <>
      <hr className="wb-hr" />
      <h3>Client notifications</h3>
      {order.emailLog.map((log, i) => {
        const label = log.type === 'order_created' ? 'Order scheduled email' : 'Delivery completed email';
        return log.success ? (
          <div className="wb-banner success" key={i} style={{ marginBottom: i === order.emailLog.length - 1 ? 0 : 8 }}>
            <strong>{label}</strong> sent to {log.to} at {fmtTime(log.sentAt)}.
          </div>
        ) : (
          <div className="wb-banner error" key={i} style={{ marginBottom: i === order.emailLog.length - 1 ? 0 : 8 }}>
            <strong>{label}</strong> failed to send ({log.error || 'unknown error'}). Check your RESEND_API_KEY and
            EMAIL_FROM environment variables.
          </div>
        );
      })}
    </>
  );
}
