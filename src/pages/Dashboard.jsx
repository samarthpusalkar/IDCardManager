import { useCardsStore, useDocumentsStore } from '../stores';

export default function Dashboard({ onNavigate }) {
  const { cards } = useCardsStore();
  const { documents } = useDocumentsStore();

  const recentDocs = documents.slice(0, 5);

  return (
    <div className="page animate-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Manage your identity cards and create print-ready documents.</p>
      </div>

      <div className="stats-grid stagger-in">
        <div className="stat-card">
          <div className="stat-card-icon">🪪</div>
          <div className="stat-card-value text-gradient">{cards.length}</div>
          <div className="stat-card-label">Cards Stored</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📄</div>
          <div className="stat-card-value text-gradient">{documents.length}</div>
          <div className="stat-card-label">Documents Created</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🔒</div>
          <div className="stat-card-value text-gradient">100%</div>
          <div className="stat-card-label">Local & Private</div>
        </div>
      </div>

      <div className="two-column-grid">
        {/* Quick Actions */}
        <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
          <h4 style={{ marginBottom: 'var(--space-5)' }}>Quick Actions</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('upload')}>
              📤 Upload New Card
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate('composer')}>
              🖨️ Create Document
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate('cards')}>
              🪪 View Card Library
            </button>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
          <h4 style={{ marginBottom: 'var(--space-5)' }}>Recent Documents</h4>
          {recentDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>📄</div>
              <p style={{ fontSize: 'var(--text-sm)' }}>No documents yet</p>
            </div>
          ) : (
            <div className="doc-list">
              {recentDocs.map((doc) => (
                <div key={doc.id} className="doc-item" onClick={() => onNavigate('composer', doc.id)}>
                  <div className="doc-item-icon">📄</div>
                  <div className="doc-item-info">
                    <div className="doc-item-title">{doc.purpose || 'Untitled'}</div>
                    <div className="doc-item-meta">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="glass-card-static" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-5)' }}>How It Works</h4>
        <div className="four-column-grid">
          {[
            { icon: '📤', title: 'Upload', desc: 'Upload front & back of your ID card' },
            { icon: '📐', title: 'Choose Template', desc: 'Select an A4 layout template' },
            { icon: '✏️', title: 'Annotate', desc: 'Add purpose text, QR codes, watermarks' },
            { icon: '🖨️', title: 'Export & Print', desc: 'Download print-ready PDF' },
          ].map((step, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>{step.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>{step.title}</div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
