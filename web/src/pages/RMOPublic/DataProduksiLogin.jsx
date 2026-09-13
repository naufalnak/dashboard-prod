import { useState } from 'react';
import { API, FL } from './shared.jsx';

/* ── Login per-Grup-Head buat tab "Data Produksi" -- beda dari sesi
   dashboard admin, tapi akunnya sama. Cluster-nya otomatis mengikuti
   Grup Head yang login (lihat GET /produksi-harian-my-cluster), jadi
   tidak perlu pilih Cluster manual. ────────────────────────────── */
export default function DataProduksiLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inp = {
    background: '#fff', border: '1px solid #c9d4d4',
    borderRadius: 7, padding: '10px 12px', color: '#1c2b2b',
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`${API}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Login gagal');
      onSuccess({ token: data.token, username: data.username || username.trim() });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, background: '#fff', border: '1px solid #d7e0e0', borderRadius: 12, padding: '32px 28px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, textAlign: 'center', color: '#0e5a52' }}>Login Data Produksi</div>
        <div style={{ fontSize: 12.5, color: '#5a6b73', textAlign: 'center', marginBottom: 22, lineHeight: 1.5 }}>
          Masuk pakai akun Grup Head masing-masing untuk melihat Data Produksi Cluster sendiri.
        </div>
        <div style={{ marginBottom: 14 }}>
          <FL>Username</FL>
          <input style={inp} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoCapitalize="off" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <FL>Password</FL>
          <input type="password" style={inp} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: '#d9534f', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={busy}
          style={{ width: '100%', padding: '11px', fontSize: 14, background: '#0e5a52', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700 }}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
