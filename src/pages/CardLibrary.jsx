import { useState, useEffect } from 'react';
import { useCardsStore, useToastStore } from '../stores';

export default function CardLibrary({ onNavigate }) {
  const { cards, deleteCard, decryptThumbnail } = useCardsStore();
  const { addToast } = useToastStore();
  const [filter, setFilter] = useState('ALL');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [thumbUrls, setThumbUrls] = useState({});

  useEffect(() => {
    let urls = {};
    let abortController = new AbortController();

    const loadSecureImage = async (card, side) => {
      try {
        const iv = side === 'front' ? card.frontThumbIv : card.backThumbIv;
        const url = await decryptThumbnail(card.id, side, iv);
        urls[card.id + '-' + side] = url;
        setThumbUrls({ ...urls });
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Error loading thumbnail', e);
          addToast(`Failed to load ${side} thumbnail for ${card.label}`, 'error');
        }
      }
    };

    cards.forEach((card) => {
      loadSecureImage(card, 'front');
      loadSecureImage(card, 'back');
    });

    return () => {
      abortController.abort();
      // Clean up object URLs when component unmounts
      Object.values(urls).forEach(URL.revokeObjectURL);
    };
  }, [cards, decryptThumbnail, addToast]);

  const filteredCards = filter === 'ALL' ? cards : cards.filter((c) => c.type === filter);

  const handleDelete = async (id) => {
    await deleteCard(id);
    setConfirmDelete(null);
    addToast('Card deleted', 'success');
  };

  const cardTypes = ['ALL', ...new Set(cards.map((c) => c.type))];

  return (
    <div className="page animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Card Library</h1>
          <p>All your stored identity cards — upload once, use everywhere.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('upload')}>
          📤 Upload Card
        </button>
      </div>

      {/* Filters */}
      {cards.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          {cardTypes.map((type) => (
            <button
              key={type}
              className={`btn btn-sm ${filter === type ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(type)}
            >
              {type === 'ALL' ? '🗂️ All' : type}
            </button>
          ))}
        </div>
      )}

      {filteredCards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🪪</div>
          <h3>No cards yet</h3>
          <p>Upload your first identity card to get started. Your cards are encrypted in-browser and stored in your account for reuse across sessions.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('upload')}>
            📤 Upload Your First Card
          </button>
        </div>
      ) : (
        <div className="card-grid stagger-in">
          {filteredCards.map((card) => (
            <div key={card.id} className="card-item">
              <div className="card-item-images">
                <img
                  src={thumbUrls[card.id + '-front'] || ''}
                  alt={`${card.label} front`}
                />
                <img
                  src={thumbUrls[card.id + '-back'] || ''}
                  alt={`${card.label} back`}
                />
              </div>
              <div className="card-item-info">
                <span className="card-item-type">{card.customType || card.type}</span>
                <div className="card-item-label">{card.label}</div>
                <div className="card-item-date">
                  Added {new Date(card.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="card-item-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => onNavigate('composer', null, card.id)}
                >
                  🖨️ Compose
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmDelete(card.id)}
                  title="Delete card"
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
              <span className="modal-title">Delete Card?</span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              This will permanently delete this card and all documents that use it as a base.
              This action cannot be undone.
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
