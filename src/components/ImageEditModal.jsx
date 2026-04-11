import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_OUTPUT_WIDTH,
  getCardAspectRatio,
  getDefaultEditorState,
  processImageOnClient,
} from '../utils/clientImageEditor';

const SLIDER_CONFIG = {
  rotationDeg: {
    id: 'rotation-range',
    label: 'Rotation',
    min: -180,
    max: 180,
    step: 1,
    unit: 'deg',
    inputMode: 'numeric',
  },
  zoom: {
    id: 'zoom-range',
    label: 'Zoom',
    min: 1,
    max: 4,
    step: 0.01,
    unit: 'x',
    inputMode: 'decimal',
  },
  offsetX: {
    id: 'pan-x-range',
    label: 'Horizontal',
    min: -50,
    max: 50,
    step: 1,
    unit: '%',
    inputMode: 'numeric',
  },
  offsetY: {
    id: 'pan-y-range',
    label: 'Vertical',
    min: -50,
    max: 50,
    step: 1,
    unit: '%',
    inputMode: 'numeric',
  },
  outputWidth: {
    id: 'output-width-range',
    label: 'Output Quality',
    min: 800,
    max: 4000,
    step: 50,
    unit: 'px',
    inputMode: 'numeric',
  },
};

const EMPTY_DRAFT = Object.freeze({});

const decimalPlacesForStep = (step) => {
  if (Number.isInteger(step)) return 0;
  return String(step).split('.')[1]?.length ?? 0;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeValue = (field, rawValue) => {
  const { min, max, step } = SLIDER_CONFIG[field];
  const precision = decimalPlacesForStep(step);
  const clampedValue = clamp(rawValue, min, max);
  const steppedValue = min + Math.round((clampedValue - min) / step) * step;
  return Number(steppedValue.toFixed(precision));
};

const isTransientDraft = (value) => value === '' || value === '-' || value === '.' || value === '-.';

function SliderField({
  config,
  value,
  draftValue,
  onRangeChange,
  onDraftChange,
  onDraftCommit,
  onNudge,
  onPointerDown,
  helpText,
}) {
  const progress = ((value - config.min) / (config.max - config.min)) * 100;

  return (
    <div className="slider-field">
      <div className="slider-field-header">
        <label htmlFor={config.id}>{config.label}</label>
        <div className="slider-number-shell">
          <input
            id={`${config.id}-number`}
            className="slider-number-input"
            type="number"
            inputMode={config.inputMode}
            min={config.min}
            max={config.max}
            step={config.step}
            value={draftValue}
            onChange={onDraftChange}
            onBlur={onDraftCommit}
            aria-label={`${config.label} numeric value`}
          />
          <span className="slider-number-unit">{config.unit}</span>
        </div>
      </div>

      <div className="slider-control-row">
        <button
          type="button"
          className="slider-stepper"
          onClick={() => onNudge(-config.step)}
          aria-label={`Decrease ${config.label}`}
        >
          -
        </button>

        <div className="slider-input-shell">
          <input
            id={config.id}
            className="range-input"
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value}
            onChange={onRangeChange}
            onPointerDown={onPointerDown}
            onMouseDown={onPointerDown}
            onTouchStart={onPointerDown}
            style={{ '--range-progress': `${progress}%` }}
          />
        </div>

        <button
          type="button"
          className="slider-stepper"
          onClick={() => onNudge(config.step)}
          aria-label={`Increase ${config.label}`}
        >
          +
        </button>
      </div>

      {helpText ? <p className="slider-help-text">{helpText}</p> : null}
    </div>
  );
}

export default function ImageEditModal({ isOpen, file, side, onClose, onApply, addToast }) {
  const [sourceUrl, setSourceUrl] = useState(null);
  const [applying, setApplying] = useState(false);
  const [editorState, setEditorState] = useState(getDefaultEditorState());
  const [draftValues, setDraftValues] = useState(EMPTY_DRAFT);

  useEffect(() => {
    if (!isOpen || !file) return undefined;
    const nextUrl = URL.createObjectURL(file);
    setSourceUrl(nextUrl);
    setEditorState(getDefaultEditorState());
    setDraftValues(EMPTY_DRAFT);
    return () => URL.revokeObjectURL(nextUrl);
  }, [isOpen, file]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const previousHtmlOverflow = html.style.overflow;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    html.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousBodyStyles.overflow;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.width = previousBodyStyles.width;
      html.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !applying) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applying, isOpen, onClose]);

  const cropAspectRatio = useMemo(() => getCardAspectRatio(), []);
  const sideLabel = side === 'front' ? 'Front' : 'Back';

  if (!isOpen || !file || typeof document === 'undefined') return null;

  const updateField = (field, nextValue) => {
    const normalizedValue = normalizeValue(field, nextValue);
    setEditorState((prev) => ({ ...prev, [field]: normalizedValue }));
    setDraftValues((prev) => {
      if (!(field in prev)) return prev;
      const nextDraftValues = { ...prev };
      delete nextDraftValues[field];
      return Object.keys(nextDraftValues).length === 0 ? EMPTY_DRAFT : nextDraftValues;
    });
  };

  const setFieldDraft = (field, nextDraftValue) => {
    setDraftValues((prev) => ({ ...prev, [field]: nextDraftValue }));
  };

  const stopRangeDragPropagation = (event) => {
    event.stopPropagation();
  };

  const handleRangeChange = (field) => (event) => {
    updateField(field, Number(event.target.value));
  };

  const handleDraftChange = (field) => (event) => {
    const rawValue = event.target.value;
    setFieldDraft(field, rawValue);

    if (isTransientDraft(rawValue)) return;

    const parsedValue = Number(rawValue);
    if (Number.isNaN(parsedValue)) return;

    setEditorState((prev) => ({
      ...prev,
      [field]: normalizeValue(field, parsedValue),
    }));
  };

  const commitDraftValue = (field) => () => {
    const rawValue = draftValues[field];
    if (rawValue == null) return;

    if (isTransientDraft(rawValue)) {
      setDraftValues((prev) => {
        const nextDraftValues = { ...prev };
        delete nextDraftValues[field];
        return Object.keys(nextDraftValues).length === 0 ? EMPTY_DRAFT : nextDraftValues;
      });
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isNaN(parsedValue)) {
      updateField(field, parsedValue);
      return;
    }

    setDraftValues((prev) => {
      const nextDraftValues = { ...prev };
      delete nextDraftValues[field];
      return Object.keys(nextDraftValues).length === 0 ? EMPTY_DRAFT : nextDraftValues;
    });
  };

  const handleNudge = (field, amount) => {
    updateField(field, editorState[field] + amount);
  };

  const resetEditor = () => {
    setEditorState(getDefaultEditorState());
    setDraftValues(EMPTY_DRAFT);
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

  const renderDraftValue = (field) => draftValues[field] ?? String(editorState[field]);

  return createPortal(
    <div className="modal-overlay image-edit-overlay" onClick={() => !applying && onClose()}>
      <div
        className="modal image-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header image-edit-header">
          <div>
            <h3 className="modal-title" id="image-edit-title">Edit {sideLabel} Image</h3>
            <p className="image-edit-subtitle">
              Center card, adjust crop, then fine-tune with large touch controls.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close image editor"
            disabled={applying}
          >
            Close
          </button>
        </div>

        <div className="image-edit-scroll-area">
          <div className="image-edit-layout">
            <div className="image-edit-preview-pane">
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

              <div className="image-edit-preview-meta">
                <p>Crop to card ratio and rotate locally on your device before preview/upload.</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetEditor} disabled={applying}>
                  Reset Adjustments
                </button>
              </div>
            </div>

            <div className="image-edit-controls-pane">
              <div className="image-edit-section">
                <SliderField
                  config={SLIDER_CONFIG.rotationDeg}
                  value={editorState.rotationDeg}
                  draftValue={renderDraftValue('rotationDeg')}
                  onRangeChange={handleRangeChange('rotationDeg')}
                  onDraftChange={handleDraftChange('rotationDeg')}
                  onDraftCommit={commitDraftValue('rotationDeg')}
                  onNudge={(amount) => handleNudge('rotationDeg', amount)}
                  onPointerDown={stopRangeDragPropagation}
                />

                <SliderField
                  config={SLIDER_CONFIG.zoom}
                  value={editorState.zoom}
                  draftValue={renderDraftValue('zoom')}
                  onRangeChange={handleRangeChange('zoom')}
                  onDraftChange={handleDraftChange('zoom')}
                  onDraftCommit={commitDraftValue('zoom')}
                  onNudge={(amount) => handleNudge('zoom', amount)}
                  onPointerDown={stopRangeDragPropagation}
                />

                <SliderField
                  config={SLIDER_CONFIG.offsetX}
                  value={editorState.offsetX}
                  draftValue={renderDraftValue('offsetX')}
                  onRangeChange={handleRangeChange('offsetX')}
                  onDraftChange={handleDraftChange('offsetX')}
                  onDraftCommit={commitDraftValue('offsetX')}
                  onNudge={(amount) => handleNudge('offsetX', amount)}
                  onPointerDown={stopRangeDragPropagation}
                />

                <SliderField
                  config={SLIDER_CONFIG.offsetY}
                  value={editorState.offsetY}
                  draftValue={renderDraftValue('offsetY')}
                  onRangeChange={handleRangeChange('offsetY')}
                  onDraftChange={handleDraftChange('offsetY')}
                  onDraftCommit={commitDraftValue('offsetY')}
                  onNudge={(amount) => handleNudge('offsetY', amount)}
                  onPointerDown={stopRangeDragPropagation}
                />
              </div>

              <details className="image-editor-advanced">
                <summary>Advanced Settings</summary>
                <div className="image-edit-section image-edit-section-compact">
                  <SliderField
                    config={SLIDER_CONFIG.outputWidth}
                    value={editorState.outputWidth}
                    draftValue={renderDraftValue('outputWidth')}
                    onRangeChange={handleRangeChange('outputWidth')}
                    onDraftChange={handleDraftChange('outputWidth')}
                    onDraftCommit={commitDraftValue('outputWidth')}
                    onNudge={(amount) => handleNudge('outputWidth', amount)}
                    onPointerDown={stopRangeDragPropagation}
                    helpText={`Default is ${DEFAULT_OUTPUT_WIDTH.toLocaleString()}px for clear A4 exports.`}
                  />
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="modal-actions image-edit-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={applying}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply} disabled={applying}>
            {applying ? <span className="spinner" /> : 'Apply & Continue'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
