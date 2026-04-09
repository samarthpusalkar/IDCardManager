import { useAuthStore } from '../stores';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'cards', icon: '🪪', label: 'Card Library' },
  { id: 'upload', icon: '📤', label: 'Upload Card' },
  { id: 'composer', icon: '🖨️', label: 'Composer' },
  { id: 'documents', icon: '📄', label: 'Documents' },
];

export default function Sidebar({ activePage, onNavigate }) {
  const { currentUser, logout } = useAuthStore();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🪪</div>
        <span className="sidebar-logo-text text-gradient">CardComposer</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-link ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-full)',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}>
            {currentUser?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{currentUser?.username}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cloud Account (Encrypted)</div>
          </div>
        </div>
        <button className="btn btn-ghost w-full btn-sm" onClick={logout}>
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
