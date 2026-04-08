import { useState, useRef } from 'react';
import { useCardsStore, useAuthStore, useToastStore } from '../stores';

const CARD_TYPES = [
  { value: 'PAN', label: 'PAN Card' },
  { value: 'DL', label: 'Driving License' },
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'VOTER_ID', label: 'Voter ID / Election Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'OTHER', label: 'Other' },
];

export default function CardUpload({ onNavigate }) {
  const { currentUser } = useAuthStore();
  const { addCard } = useCardsStore();
  const { addToast } = useToastStore();

  const [cardType, setCardType] = useState('PAN');
  const [customType, setCustomType] = useState('');
  const [label, setLabel] = useState('');
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const frontRef = useRef(null);
  const backRef = useRef(null);

  const handleImageSelect = (file, side) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file', 'error');
      return;
    }
    const url = URL.createObjectURL(file);
    if (side === 'front') {
      setFrontImage(file);
      setFrontPreview(url);
    } else {
      setBackImage(file);
      setBackPreview(url);
    }
  };

  const handleDrop = (e, side) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleImageSelect(file, side);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!frontImage || !backImage) {
      addToast('Please upload both front and back images', 'error');
      return;
    }
    if (!label.trim()) {
      addToast('Please enter a label', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Convert File to Blob
      const frontBlob = new Blob([await frontImage.arrayBuffer()], { type: frontImage.type });
      const backBlob = new Blob([await backImage.arrayBuffer()], { type: backImage.type });

      await addCard({
        userId: currentUser.id,
        type: cardType,
        customType: cardType === 'OTHER' ? customType : null,
        label: label.trim(),
        frontImage: frontBlob,
        backImage: backBlob,
      });

      addToast('Card saved successfully!', 'success');
      onNavigate('cards');
    } catch (err) {
      console.error(err);
      addToast('Failed to save card', 'error');
    }
    setSubmitting(false);
  };

  const removeImage = (side) => {
    if (side === 'front') {
      setFrontImage(null);
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontPreview(null);
    } else {
      setBackImage(null);
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackPreview(null);
    }
  };

  return (
    <div className="page animate-in">
      <div className="page-header">
        <h1>Upload Card</h1>
        <p>Add a new identity card to your library. Upload both front and back images.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          {/* Front Image */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)' }}>
            <h4 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-lg)' }}>📸</span> Front Side
            </h4>
            {frontPreview ? (
              <div className="image-preview">
                <img src={frontPreview} alt="Front preview" style={{ maxHeight: 240 }} />
                <div className="image-preview-overlay">
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeImage('front')}
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="dropzone"
                onClick={() => frontRef.current?.click()}
                onDrop={(e) => handleDrop(e, 'front')}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="dropzone-icon">📷</div>
                <div className="dropzone-text">
                  <strong>Click to upload</strong> or drag & drop
                </div>
                <div className="dropzone-text">JPEG, PNG, WebP</div>
              </div>
            )}
            <input
              ref={frontRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleImageSelect(e.target.files[0], 'front')}
            />
          </div>

          {/* Back Image */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)' }}>
            <h4 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-lg)' }}>📸</span> Back Side
            </h4>
            {backPreview ? (
              <div className="image-preview">
                <img src={backPreview} alt="Back preview" style={{ maxHeight: 240 }} />
                <div className="image-preview-overlay">
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeImage('back')}
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="dropzone"
                onClick={() => backRef.current?.click()}
                onDrop={(e) => handleDrop(e, 'back')}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="dropzone-icon">📷</div>
                <div className="dropzone-text">
                  <strong>Click to upload</strong> or drag & drop
                </div>
                <div className="dropzone-text">JPEG, PNG, WebP</div>
              </div>
            )}
            <input
              ref={backRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleImageSelect(e.target.files[0], 'back')}
            />
          </div>
        </div>

        {/* Card Details */}
        <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
          <h4 style={{ marginBottom: 'var(--space-5)' }}>Card Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div className="input-group">
              <label htmlFor="card-type">Card Type</label>
              <select
                id="card-type"
                className="input"
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
              >
                {CARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {cardType === 'OTHER' && (
              <div className="input-group">
                <label htmlFor="custom-type">Custom Type</label>
                <input
                  id="custom-type"
                  className="input"
                  type="text"
                  placeholder="e.g., Employee ID"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
              </div>
            )}

            <div className="input-group" style={{ gridColumn: cardType === 'OTHER' ? 'span 2' : 'auto' }}>
              <label htmlFor="card-label">Label</label>
              <input
                id="card-label"
                className="input"
                type="text"
                placeholder="e.g., Samarth - PAN Card"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate('cards')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting || !frontImage || !backImage}
            >
              {submitting ? <span className="spinner" /> : '💾 Save Card'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
