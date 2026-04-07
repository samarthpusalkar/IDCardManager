import { useToastStore } from '../stores';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <span>
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.type === 'info' && 'ℹ️'}
          </span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: 'var(--space-1)', opacity: 0.5 }}
            onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
