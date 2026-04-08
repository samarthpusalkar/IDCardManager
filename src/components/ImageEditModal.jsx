import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_OUTPUT_WIDTH,
  getCardAspectRatio,
  getDefaultEditorState,
  processImageOnClient,
} from '../utils/clientImageEditor';

export default function ImageEditModal({ isOpen, file, side, onClose, onApply, addToast }) {
  const [sourceUrl, setSourceUrl] = useState(null);
  const [applying, setApplying] = useState(false);
  const [editorState, setEditorState] = useState(getDefaultEditorState());

  useEffect(() => {
    if (!isOpen || !file) return undefined;
    const nextUrl = URL.createObjectURL(file);
    setSourceUrl(nextUrl);
    setEditorState(getDefaultEditorState());
    return () => URL.revokeObjectURL(nextUrl);
  }, [isOpen, file]);

  const cropAspectRatio = useMemo(() => getCardAspectRatio(), []);
  const sideLabel = side === 'front' ? 'Front' : 'Back';

  if (!isOpen || !file) return null;

  const handleChange = (field) => (event) => {
    const value = Number(event.target.value);
    setEditorState((prev) => ({ ...prev, [field]: value }));
  };

  const resetEditor = () => {
    setEditorState(getDefaultEditorState());
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const processedFile = await processImageOnClient(file, editorState);
      onApply(side, processedFile);
    } catch (error) {
      console.error(error);
      addToast('Unable to process image on this device/browser', 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal image-edit-modal">
        <div className="modal-header">
          <h3 className="modal-title">Edit {sideLabel} Image</h3>
        </div>

        <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          Crop to card ratio and rotate locally on your device before preview/upload.
        </p>

        <div className="image-editor-stage">
          <div className="image-editor-frame" style={{ aspectRatio: cropAspectRatio }}>
            {sourceUrl && (
              <div
                className="image-editor-rotate-scale"
                style={{
                  transform: `rotate(${editorState.rotationDeg}deg) scale(${editorState.zoom})`,
                }}
              >
                <img
                  src={sourceUrl}
                  alt={`Edit ${sideLabel}`}
                  style={{
                    transform: `translate(${editorState.offsetX}%, ${editorState.offsetY}%)`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="composer-panel-content" style={{ padding: 0, gap: 'var(--space-3)' }}>
          <div className="range-group">
            <label htmlFor="rotation-range">Rotation <span>{editorState.rotationDeg}deg</span></label>
            <input
              id="rotation-range"
              type="range"
              min="-180"
              max="180"
              step="1"
              value={editorState.rotationDeg}
              onChange={handleChange('rotationDeg')}
            />
          </div>

          <div className="range-group">
            <label htmlFor="zoom-range">Zoom <span>{editorState.zoom.toFixed(2)}x</span></label>
            <input
              id="zoom-range"
              type="range"
              min="1"
              max="4"
              step="0.01"
              value={editorState.zoom}
              onChange={handleChange('zoom')}
            />
          </div>

          <div className="range-group">
            <label htmlFor="pan-x-range">Horizontal <span>{editorState.offsetX}%</span></label>
            <input
              id="pan-x-range"
              type="range"
              min="-50"
              max="50"
              step="1"
              value={editorState.offsetX}
              onChange={handleChange('offsetX')}
            />
          </div>

          <div className="range-group">
            <label htmlFor="pan-y-range">Vertical <span>{editorState.offsetY}%</span></label>
            <input
              id="pan-y-range"
              type="range"
              min="-50"
              max="50"
              step="1"
              value={editorState.offsetY}
              onChange={handleChange('offsetY')}
            />
          </div>
        </div>

        <details className="image-editor-advanced">
          <summary>Advanced settings</summary>
          <div className="range-group" style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="output-width-range">Output quality <span>{editorState.outputWidth}px</span></label>
            <input
              id="output-width-range"
              type="range"
              min="800"
              max="4000"
              step="50"
              value={editorState.outputWidth}
              onChange={handleChange('outputWidth')}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              Default is {DEFAULT_OUTPUT_WIDTH}px (A4 print-friendly quality).
            </p>
          </div>
        </details>

        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetEditor}>Reset</button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={applying}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply} disabled={applying}>
            {applying ? <span className="spinner" /> : 'Apply & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
