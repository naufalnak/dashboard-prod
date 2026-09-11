import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

// Pengganti window.confirm() bawaan browser -- notifikasi konfirmasi
// custom di tengah layar, dipakai di seluruh website untuk aksi hapus
// data/item. confirm(message) mengembalikan Promise<boolean>, dipakai
// persis seperti window.confirm() tapi async: `if (!(await confirm(...))) return;`
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, confirmLabel: opts.confirmLabel || 'Hapus', cancelLabel: opts.cancelLabel || 'Batal' });
    });
  }, []);

  function settle(result) {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => settle(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={32} style={{ color: 'var(--red)', marginBottom: 10 }} />
            <div className="confirm-message">{state.message}</div>
            <div className="confirm-actions">
              <button className="btn" onClick={() => settle(false)}>{state.cancelLabel}</button>
              <button className="btn danger" onClick={() => settle(true)}>{state.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
