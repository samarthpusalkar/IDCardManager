import { useEffect, useState } from 'react';
import { useDocumentsStore, useCardsStore, useToastStore } from '../stores';

export default function DocumentHistory({ onNavigate }) {
  const { documents, deleteDocument } = useDocumentsStore();
  const { cards } = useCardsStore();
  const { addToast } = useToastStore();
  const [confirmDelete, setConfirmDelete] = useState(null);

  const getCardLabel = (cardId) => {
    const card = cards.find((c) => c.id === cardId);
    return card ? `${card.label} (${card.customType || card.type})` : 'Unknown card';
  };

  const handleDelete = async (docId) => {
    await deleteDocument(docId);
    setConfirmDelete(null);
    addToast('Document deleted', 'success');
  };

  return (
    <div className="page animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Document History</h1>
          <p>All your exported documents — reuse cards for different purposes without re-uploading.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('composer')}>
          🖨️ New Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3>No documents yet</h3>
          <p>Create your first document by selecting a card and exporting it from the Composer.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('composer')}>
            🖨️ Create Document
          </button>
        </div>
      ) : (
        <div className="doc-list stagger-in">
          {documents.map((doc) => (
            <div key={doc.id} className="doc-item">
              <div className="doc-item-icon">📄</div>
              <div className="doc-item-info" style={{ flex: 1 }}>
                <div className="doc-item-title">{doc.purpose || 'Untitled Document'}</div>
                <div className="doc-item-meta">
                  {getCardLabel(doc.cardId)} • {new Date(doc.createdAt).toLocaleDateString()} at{' '}
                  {new Date(doc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {doc.exportSettings?.filter && doc.exportSettings.filter !== 'original' && (
                    <span className="badge badge-primary" style={{ marginLeft: 'var(--space-2)' }}>
                      {doc.exportSettings.filter}
                    </span>
                  )}
                </div>
              </div>
              <div className="doc-item-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigate('composer', doc.id, doc.cardId)}
                  title="Recreate this document"
                >
                  🔄 Recreate
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmDelete(doc.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Document?</span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              This will remove this document record. Your base card images will not be affected.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
