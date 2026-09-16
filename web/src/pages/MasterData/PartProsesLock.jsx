import { useState } from 'react';
import { Lock } from 'lucide-react';
import { apiSend } from '../../api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

// Layar kunci untuk tab "Part Name & Proses" -- password yang diminta
// adalah password LOGIN akun ini sendiri (bukan password terpisah),
// diverifikasi ulang ke server lewat POST /unlock-part-proses (bcrypt ke
// hash tersimpan, bukan dicek di sini). Cuma tampil untuk akun yang
// memang boleh mengakses tab ini (lihat canAccessPartProses di roles.js,
// dicek juga sebelum komponen ini dirender) -- backend TETAP menolak
// akun lain walau tahu passwordnya sendiri, ini cuma UX re-konfirmasi
// bukan celah baru.
export default function PartProsesLock({ onUnlocked }) {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await apiSend('/unlock-part-proses', 'POST', { password }, logout);
      onUnlocked();
    } catch (e) {
      setError(e.message || 'Password salah');
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ maxWidth: 360, margin: '40px auto', textAlign: 'center', padding: 28 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: 'var(--s2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
      }}>
        <Lock size={20} style={{ color: 'var(--muted)' }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Part Name & Proses Terkunci</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
        Masukkan password login Anda untuk membuka tab ini.
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password login" className="form-input" style={{ textAlign: 'center' }}
        />
        {error && <div style={{ fontSize: 11.5, color: 'var(--red)' }}>{error}</div>}
        <button type="submit" className="btn primary" disabled={busy || !password}>
          {busy ? 'Memeriksa…' : 'Buka'}
        </button>
      </form>
    </div>
  );
}
