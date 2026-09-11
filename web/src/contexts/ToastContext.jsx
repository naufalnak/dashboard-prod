import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((msg, type = 'green', dur = 3200) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg, type, removing: false }]);
    setTimeout(() => removeToast(id), dur);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, removing: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={'toast-item' + (t.removing ? ' removing' : '')}
            style={{ borderLeft: `3px solid ${t.type === 'red' ? 'var(--red)' : 'var(--green)'}` }}
            onClick={() => removeToast(t.id)}
          >
            {t.type === 'red'
              ? <XCircle size={16} color="var(--red)" style={{ flexShrink: 0 }} />
              : <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0 }} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
