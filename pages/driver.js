import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import SignaturePad from '../components/SignaturePad';
import { Header, Footer, StatusRail, PodBlock, EmailStatus } from '../components/Shared';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: { driverName: session.name } };
}

export default function DriverConsole({ driverName }) {
  const [screen, setScreen] = useState('list'); // list | new | detail | complete
  const [orders, setOrders] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState(null);
  const [justCreated, setJustCreated] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3800);
  }

  async function loadOrders() {
    setLoadingList(true);
    try {
      const r = await fetch('/api/orders');
      const data = await r.json();
      if (r.ok) setOrders(data.orders || []);
      else toast(data.error || 'Failed to load orders');
    } catch (e) {
      toast('Network error loading orders');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadOrder(id) {
    const r = await fetch(`/api/orders/${id}`);
    const data = await r.json();
    if (r.ok) return data.order;
    toast(data.error || 'Failed to load order');
    return null;
  }

  useEffect(() => {
    if (screen === 'list') loadOrders();
  }, [screen]);

  async function openOrder(id) {
    const order = await loadOrder(id);
    if (order) {
      setSelected(order);
      setJustCreated(false);
      setScreen('detail');
    }
  }

  async function advanceStatus(nextStatus) {
    const r = await fetch(`/api/orders/${selected.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await r.json();
    if (r.ok) {
      setSelected(data.order);
      toast(`Status updated: ${nextStatus.replace('_', ' ')}`);
    } else {
      toast(data.error || 'Failed to update status');
    }
  }

  return (
    <>
      <Head>
        <title>Driver Console — Honest Care Medical Delivery</title>
      </Head>
      <Header active="driver" />
      <div className="wb-shell">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="wb-note">Signed in as <strong>{driverName}</strong></span>
        <button
          className="wb-btn outline small"
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
        >
          Sign out
        </button>
      </div>
      {screen === 'list' && (
        <OrderList
          orders={orders}
          loading={loadingList}
          onNew={() => setScreen('new')}
          onOpen={openOrder}
        />
      )}

      {screen === 'new' && (
        <NewOrderForm
          defaultDriverName={driverName}
          onCancel={() => setScreen('list')}
          onCreated={(order) => {
            setSelected(order);
            setJustCreated(true);
            setScreen('detail');
          }}
          toast={toast}
        />
      )}

      {screen === 'detail' && selected && (
        <OrderDetail
          order={selected}
          justCreated={justCreated}
          onBack={() => setScreen('list')}
          onAdvance={advanceStatus}
          onComplete={() => setScreen('complete')}
        />
      )}

      {screen === 'complete' && selected && (
        <CompletionPanel
          order={selected}
          onBack={() => setScreen('detail')}
          onDone={(order) => {
            setSelected(order);
            setScreen('detail');
          }}
          toast={toast}
        />
      )}

      {toastMsg && <div className="wb-toast">{toastMsg}</div>}
      </div>
      <Footer />
    </>
  );
}

function OrderList({ orders, loading, onNew, onOpen }) {
  return (
    <div className="wb-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Active Orders</h2>
        <button className="wb-btn" onClick={onNew}>
          + New Order
        </button>
      </div>
      {loading && <div className="wb-empty">Loading orders&hellip;</div>}
      {!loading && orders.length === 0 && (
        <div className="wb-empty">No orders yet. Create one to get started.</div>
      )}
      {!loading &&
        orders.map((o) => (
          <div key={o.id} className="wb-order-row" onClick={() => onOpen(o.id)}>
            <div>
              <div className="wb-ofac">{o.facility}</div>
              <div className="wb-oid">
                {o.id} &middot; {o.address}
              </div>
            </div>
            <span className={`wb-badge ${o.status}`}>{o.status.replace('_', ' ')}</span>
          </div>
        ))}
    </div>
  );
}

function NewOrderForm({ onCancel, onCreated, toast, defaultDriverName }) {
  const [form, setForm] = useState({
    facility: '',
    driverName: defaultDriverName || '',
    contactName: '',
    contactEmail: '',
    address: '',
    items: '',
  });
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit() {
    if (!form.facility.trim() || !form.address.trim() || !form.contactEmail.trim()) {
      toast('Facility, address, and contact email are required.');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (r.ok) {
        if (data.email && data.email.sent) {
          toast(`Order created. Tracking number emailed to ${data.order.contactEmail}.`);
        } else {
          toast('Order created, but the tracking email failed to send (see order details).');
        }
        onCreated(data.order);
      } else {
        toast(data.error || 'Could not create order');
        setSaving(false);
      }
    } catch (e) {
      toast('Network error creating order');
      setSaving(false);
    }
  }

  return (
    <div className="wb-card">
      <h2>New Delivery Order</h2>
      <div className="wb-grid">
        <div>
          <label>Facility / Client name</label>
          <input type="text" value={form.facility} onChange={set('facility')} placeholder="St. Bernadette Clinic" />
        </div>
        <div>
          <label>Driver name</label>
          <input type="text" value={form.driverName} onChange={set('driverName')} placeholder="Your name" />
        </div>
        <div>
          <label>Contact name</label>
          <input type="text" value={form.contactName} onChange={set('contactName')} placeholder="Receiving contact" />
        </div>
        <div>
          <label>Contact email</label>
          <input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="ops@clinic.org" />
        </div>
      </div>
      <label>Delivery address</label>
      <input type="text" value={form.address} onChange={set('address')} placeholder="123 Health Way, Suite 4" />
      <label>Items / description</label>
      <textarea
        value={form.items}
        onChange={set('items')}
        placeholder="e.g. Sealed specimen kit, 2 boxes of supplies"
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button className="wb-btn" disabled={saving} onClick={submit}>
          {saving ? 'Creating\u2026' : 'Create Order'}
        </button>
        <button className="wb-btn outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PhoneIntakeDetails({ order }) {
  const rows = [
    ['Caller', order.callerName],
    ['Callback number', order.callerPhone],
    ['Account number', order.accountNumber],
    ['Pickup facility', order.pickupFacility],
    ['Pickup address', order.pickupAddress],
    ['Pickup contact', [order.pickupContactName, order.pickupContactPhone].filter(Boolean).join(' \u00b7 ')],
    ['Service type', order.serviceType],
    ['Ready time', order.readyTime],
    ['Delivery deadline', order.deadline],
    ['Temperature', order.tempRequirement],
    ['Vehicle requirement', order.vehicleRequirement],
    ['Chain of custody', order.chainOfCustody ? 'Required' : null],
    ['PO / reference #', order.poNumber],
    ['SMS updates', order.smsOptIn ? 'Opted in' : null],
    ['Pickup notes', order.specialInstructionsPickup],
    ['Delivery notes', order.specialInstructionsDelivery],
  ].filter(([, value]) => value);

  if (rows.length === 0) return null;

  return (
    <>
      <hr className="wb-hr" />
      <h3>Phone intake details</h3>
      <div className="wb-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <label>{label}</label>
            <div style={{ fontSize: 14 }}>{value}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function OrderDetail({ order, justCreated, onBack, onAdvance, onComplete }) {
  const nextAction = {
    pending: { key: 'in_transit', label: 'Start: Mark In Transit', cls: 'amber' },
    in_transit: { key: 'onsite', label: 'Mark Onsite', cls: 'blue' },
  }[order.status];
  const isPhoneOrder = order.source === 'phone_agent';

  return (
    <>
      <button className="wb-btn outline small" style={{ marginBottom: 14 }} onClick={onBack}>
        &larr; All Orders
      </button>
      <div className="wb-card">
        {justCreated && (
          <div className="wb-banner success">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Order created</div>
            <div className="wb-note">
              Share this tracking code with the client (in production they&rsquo;d receive a secure link
              automatically by email/SMS):
            </div>
            <div className="wb-tracklink" style={{ marginTop: 6 }}>
              {order.trackingCode}
            </div>
          </div>
        )}
        {order.status === 'pending_review' && (
          <div className="wb-banner" style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Awaiting dispatcher review</div>
            <div className="wb-note">
              This order came in through the phone dispatch agent. Review the details below, then approve it to
              release it into the normal driver workflow.
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ marginBottom: 2 }}>{order.facility}</h2>
            <div className="wb-oid">
              {order.id} &middot; tracking {order.trackingCode}
              {isPhoneOrder && <> &middot; via phone agent</>}
            </div>
          </div>
          <span className={`wb-badge ${order.status}`}>{order.status.replace(/_/g, ' ')}</span>
        </div>
        <hr className="wb-hr" />
        <div className="wb-grid">
          <div>
            <label>{isPhoneOrder ? 'Delivery address' : 'Address'}</label>
            <div style={{ fontSize: 14 }}>{order.address}</div>
          </div>
          <div>
            <label>Items</label>
            <div style={{ fontSize: 14 }}>{order.items || '\u2014'}</div>
          </div>
          <div>
            <label>Contact</label>
            <div style={{ fontSize: 14 }}>{order.contactName || '\u2014'}</div>
          </div>
          <div>
            <label>Contact email</label>
            <div style={{ fontSize: 14 }}>{order.contactEmail}</div>
          </div>
        </div>

        {isPhoneOrder && <PhoneIntakeDetails order={order} />}

        <StatusRail order={order} />

        {order.status === 'pending_review' && (
          <button className="wb-btn teal" onClick={() => onAdvance('pending')}>
            Approve Order
          </button>
        )}
        {order.status !== 'completed' && order.status !== 'pending_review' && order.status !== 'cancelled' &&
          (order.status === 'onsite' ? (
            <button className="wb-btn teal" onClick={onComplete}>
              Complete Delivery
            </button>
          ) : (
            <button className={`wb-btn ${nextAction.cls}`} onClick={() => onAdvance(nextAction.key)}>
              {nextAction.label}
            </button>
          ))}

        {order.status === 'completed' && <PodBlock order={order} />}
        <EmailStatus order={order} />
      </div>
    </>
  );
}

function CompletionPanel({ order, onBack, onDone, toast }) {
  const sigRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((p) => [...p, reader.result]);
      reader.readAsDataURL(file);
    });
  }

  async function submit() {
    if (!sigRef.current || sigRef.current.isBlank()) {
      toast('Please capture the recipient signature before completing.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/orders/${order.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: sigRef.current.getDataUrl(),
          photos,
          notes,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        if (data.email && data.email.sent) {
          toast(`Delivery completed. Confirmation email sent to ${order.contactEmail}.`);
        } else {
          toast('Delivery completed, but the notification email failed to send (see order details).');
        }
        onDone(data.order);
      } else {
        toast(data.error || 'Could not save proof of delivery');
        setSubmitting(false);
      }
    } catch (e) {
      toast('Network error completing delivery');
      setSubmitting(false);
    }
  }

  return (
    <>
      <button className="wb-btn outline small" style={{ marginBottom: 14 }} onClick={onBack}>
        &larr; Back to order
      </button>
      <div className="wb-card">
        <h2>Complete Delivery &mdash; Capture Proof</h2>
        <div className="wb-oid" style={{ marginBottom: 14 }}>
          {order.id} &middot; {order.facility}
        </div>

        <label>Recipient signature</label>
        <SignaturePad ref={sigRef} />
        <div style={{ margin: '8px 0 16px' }}>
          <button className="wb-btn outline small" onClick={() => sigRef.current && sigRef.current.clear()}>
            Clear signature
          </button>
        </div>

        <label>Delivery photos</label>
        <input type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} />
        <div className="wb-photo-grid">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} className="wb-photo-thumb" src={p} alt={`Captured photo ${i + 1}`} />
          ))}
        </div>

        <label>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Left with front desk, receiving staff confirmed intact seal"
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button className="wb-btn teal" disabled={submitting} onClick={submit}>
            {submitting ? 'Completing\u2026' : 'Complete Delivery & Notify Client'}
          </button>
          <button className="wb-btn outline" onClick={onBack}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

