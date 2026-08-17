import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Header, Footer } from '../../components/Shared';

export default function TrackEntry() {
  const [code, setCode] = useState('');
  const router = useRouter();

  function go() {
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/track/${encodeURIComponent(trimmed.toUpperCase())}`);
  }

  return (
    <>
      <Head>
        <title>Track Your Delivery — Honest Care Medical Delivery</title>
      </Head>
      <Header active="client" />
      <div className="wb-shell">
      <div className="wb-card">
        <h2>Track Your Delivery</h2>
        <div className="wb-note" style={{ marginBottom: 14 }}>
          In production this page opens automatically from the secure link emailed to you. For testing, enter the
          tracking code your driver gave you.
        </div>
        <label>Tracking code</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="TRK-XXXXXXXX"
            style={{ marginBottom: 0 }}
          />
          <button className="wb-btn" onClick={go}>
            Track
          </button>
        </div>
      </div>
      </div>
      <Footer />
    </>
  );
}
