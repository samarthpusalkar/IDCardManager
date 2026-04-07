import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, FabricText, Rect } from 'fabric';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  useCardsStore,
  useTemplatesStore,
  useDocumentsStore,
  useAuthStore,
  useToastStore,
} from '../stores';

// A4 at 150 DPI for preview (half of print quality)
const PREVIEW_DPI = 150;
const PRINT_DPI = 300;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const mmToPx = (mm, dpi) => (mm / 25.4) * dpi;

const PRESET_TEXTS = [
  'For LPG connection application only',
  'For passport verification only',
  'For bank KYC only',
  'For insurance application only',
  'For address verification only',
  'Self attested copy',
];

const EXPORT_FILTERS = [
  { value: 'original', label: 'Original (Color)', icon: '🎨' },
  { value: 'grayscale', label: 'Grayscale (B&W)', icon: '🖤' },
  { value: 'watermarked', label: 'Watermarked', icon: '💧' },
];

export default function DocumentComposer({ onNavigate, editDocId, preselectedCardId }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const { currentUser } = useAuthStore();
  const { cards, getCard } = useCardsStore();
  const { templates } = useTemplatesStore();
  const { addDocument, updateDocument, getDocument } = useDocumentsStore();
  const { addToast } = useToastStore();

  // State
  const [selectedCardId, setSelectedCardId] = useState(preselectedCardId || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-standard-vertical');
  const [useCustomLayout, setUseCustomLayout] = useState(false);
  const [customLayout, setCustomLayout] = useState([
    { type: 'front', cx: 50, cy: 25, maxW: 90, maxH: 45 },
    { type: 'back', cx: 50, cy: 75, maxW: 90, maxH: 45 },
  ]);
  const [purpose, setPurpose] = useState('');
  const [overlays, setOverlays] = useState([]);
  const [exportFilter, setExportFilter] = useState('original');
  const [watermarkText, setWatermarkText] = useState('COPY');
  const [exporting, setExporting] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // Text overlay controls
  const [newText, setNewText] = useState('');
  const [textFontSize, setTextFontSize] = useState(24);
  const [textOpacity, setTextOpacity] = useState(70);
  const [textRotation, setTextRotation] = useState(-30);
  const [textColor, setTextColor] = useState('#ff5a6e');

  // QR controls
  const [qrText, setQrText] = useState('');
  const [qrSize, setQrSize] = useState(80);

  // Signature
  const [signatureFile, setSignatureFile] = useState(null);
  const sigInputRef = useRef(null);

  // Active tool tab
  const [activeTab, setActiveTab] = useState('text');

  // Preview scale
  const previewWidth = mmToPx(A4_WIDTH_MM, PREVIEW_DPI);
  const previewHeight = mmToPx(A4_HEIGHT_MM, PREVIEW_DPI);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    // Prevent double init
    if (fabricRef.current) {
      fabricRef.current.dispose();
    }

    const canvas = new FabricCanvas(canvasRef.current, {
      width: previewWidth,
      height: previewHeight,
      backgroundColor: '#ffffff',
      selection: true,
    });

    fabricRef.current = canvas;
    setCanvasReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, []);

  // Render card images when card or template changes
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    renderCardOnCanvas();
  }, [selectedCardId, selectedTemplateId, canvasReady, useCustomLayout, customLayout]);

  const renderCardOnCanvas = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedCardId) return;

    // Clear existing card images (keep overlays)
    const overlayObjects = canvas.getObjects().filter(
      (obj) => obj._overlayType
    );
    canvas.clear();
    canvas.backgroundColor = '#ffffff';

    const card = await getCard(selectedCardId);
    if (!card) return;

    let slots = [];
    if (useCustomLayout) {
      slots = customLayout;
    } else {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (!template) return;
      slots = template.layout.slots;
    }

    for (const slot of slots) {
      const blob = slot.type === 'front' ? card.frontImage : card.backImage;
      const url = URL.createObjectURL(blob);

      try {
        const img = await FabricImage.fromURL(url);
        const cxPx = (slot.cx / 100) * previewWidth;
        const cyPx = (slot.cy / 100) * previewHeight;
        const maxWPx = (slot.maxW / 100) * previewWidth;
        const maxHPx = (slot.maxH / 100) * previewHeight;

        // Scale to fit within slot boundaries
        const imgW = img.width;
        const imgH = img.height;
        const scaleX = maxWPx / imgW;
        const scaleY = maxHPx / imgH;
        const scale = Math.min(scaleX, scaleY);

        img.set({
          left: cxPx,
          top: cyPx,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          _cardImage: true,
        });

        canvas.add(img);
      } catch (e) {
        console.error('Error loading image', e);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    // Re-add overlay objects
    overlayObjects.forEach((obj) => canvas.add(obj));
    canvas.renderAll();
  }, [selectedCardId, selectedTemplateId, templates, getCard, canvasReady]);

  // Add text overlay
  const addTextOverlay = (text) => {
    if (!text.trim() || !fabricRef.current) return;

    const textObj = new FabricText(text, {
      left: previewWidth / 2,
      top: previewHeight / 2,
      fontSize: textFontSize,
      fill: textColor,
      opacity: textOpacity / 100,
      angle: textRotation,
      fontFamily: 'Inter, sans-serif',
      fontWeight: '600',
      originX: 'center',
      originY: 'center',
      _overlayType: 'text',
    });

    fabricRef.current.add(textObj);
    fabricRef.current.setActiveObject(textObj);
    fabricRef.current.renderAll();
    setNewText('');
    addToast('Text overlay added', 'success');
  };

  // Add QR code overlay
  const addQrOverlay = async () => {
    if (!qrText.trim() || !fabricRef.current) return;

    try {
      const qrDataUrl = await QRCode.toDataURL(qrText, {
        width: qrSize * 3,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });

      const img = await FabricImage.fromURL(qrDataUrl);
      const scale = mmToPx(qrSize, PREVIEW_DPI) / img.width;
      img.set({
        left: previewWidth - mmToPx(30, PREVIEW_DPI),
        top: previewHeight - mmToPx(30, PREVIEW_DPI),
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        _overlayType: 'qr',
      });

      fabricRef.current.add(img);
      fabricRef.current.setActiveObject(img);
      fabricRef.current.renderAll();
      addToast('QR code added', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to generate QR code', 'error');
    }
  };

  // Add signature overlay
  const addSignatureOverlay = async (file) => {
    if (!file || !fabricRef.current) return;

    const url = URL.createObjectURL(file);
    try {
      const img = await FabricImage.fromURL(url);
      const maxW = mmToPx(40, PREVIEW_DPI);
      const scale = maxW / img.width;
      img.set({
        left: previewWidth / 2,
        top: previewHeight - mmToPx(40, PREVIEW_DPI),
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        _overlayType: 'signature',
      });

      fabricRef.current.add(img);
      fabricRef.current.setActiveObject(img);
      fabricRef.current.renderAll();
      addToast('Signature added (visual only)', 'info');
    } catch (e) {
      console.error(e);
      addToast('Failed to add signature', 'error');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // Delete selected overlay
  const deleteSelectedOverlay = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && active._overlayType) {
      canvas.remove(active);
      canvas.renderAll();
      addToast('Overlay removed', 'info');
    }
  };

  // Apply watermark filter to canvas for export
  const applyExportFilter = (canvas) => {
    if (exportFilter === 'grayscale') {
      // Add grayscale overlay
      const overlay = new Rect({
        left: 0,
        top: 0,
        width: canvas.width,
        height: canvas.height,
        fill: 'transparent',
        selectable: false,
        evented: false,
      });
      canvas.add(overlay);

      // Apply grayscale via canvas manipulation (done post-export)
    } else if (exportFilter === 'watermarked') {
      // Add repeating watermark text
      const spacing = mmToPx(60, PREVIEW_DPI);
      for (let x = 0; x < canvas.width; x += spacing) {
        for (let y = 0; y < canvas.height; y += spacing) {
          const wm = new FabricText(watermarkText || 'COPY', {
            left: x + spacing / 2,
            top: y + spacing / 2,
            fontSize: 36,
            fill: '#888888',
            opacity: 0.15,
            angle: -35,
            fontFamily: 'Inter, sans-serif',
            fontWeight: '700',
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            _watermark: true,
          });
          canvas.add(wm);
        }
      }
      canvas.renderAll();
    }
  };

  // Export as PDF
  const exportPDF = async () => {
    if (!fabricRef.current || !selectedCardId) {
      addToast('Please select a card first', 'error');
      return;
    }

    setExporting(true);
    try {
      const canvas = fabricRef.current;

      // Apply watermarks if needed
      applyExportFilter(canvas);

      // Get canvas as image
      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: PRINT_DPI / PREVIEW_DPI,
      });

      // Apply grayscale if needed
      let finalDataUrl = dataUrl;
      if (exportFilter === 'grayscale') {
        finalDataUrl = await applyGrayscale(dataUrl);
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.addImage(finalDataUrl, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);

      const card = await getCard(selectedCardId);
      const fileName = `${card?.type || 'Card'}_${purpose?.replace(/\s+/g, '_') || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      // Remove watermarks from canvas
      const wmObjs = canvas.getObjects().filter((o) => o._watermark);
      wmObjs.forEach((o) => canvas.remove(o));
      canvas.renderAll();

      // Save document record
      await addDocument({
        userId: currentUser.id,
        cardId: selectedCardId,
        templateId: selectedTemplateId,
        purpose: purpose || 'Untitled',
        overlays: [],
        exportSettings: { filter: exportFilter, watermarkText, dpi: PRINT_DPI, format: 'pdf' },
      });

      addToast('PDF exported successfully!', 'success');
    } catch (e) {
      console.error(e);
      addToast('Export failed', 'error');
    }
    setExporting(false);
  };

  // Export as PNG
  const exportPNG = async () => {
    if (!fabricRef.current || !selectedCardId) {
      addToast('Please select a card first', 'error');
      return;
    }

    setExporting(true);
    try {
      const canvas = fabricRef.current;
      applyExportFilter(canvas);

      let dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: PRINT_DPI / PREVIEW_DPI,
      });

      if (exportFilter === 'grayscale') {
        dataUrl = await applyGrayscale(dataUrl);
      }

      const link = document.createElement('a');
      const card = await getCard(selectedCardId);
      link.download = `${card?.type || 'Card'}_${purpose?.replace(/\s+/g, '_') || 'document'}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      // Remove watermarks
      const wmObjs = canvas.getObjects().filter((o) => o._watermark);
      wmObjs.forEach((o) => canvas.remove(o));
      canvas.renderAll();

      addToast('PNG exported successfully!', 'success');
    } catch (e) {
      console.error(e);
      addToast('Export failed', 'error');
    }
    setExporting(false);
  };

  // Card thumbnails
  const [cardThumbUrls, setCardThumbUrls] = useState({});
  useEffect(() => {
    const urls = {};
    cards.forEach((card) => {
      if (card.frontThumb) {
        urls[card.id] = URL.createObjectURL(card.frontThumb);
      }
    });
    setCardThumbUrls(urls);
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, [cards]);

  // Canvas scale for display
  const [displayScale, setDisplayScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      if (canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth - 48;
        const scale = Math.min(1, containerWidth / previewWidth);
        setDisplayScale(scale);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [previewWidth]);

  return (
    <div className="page animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Document Composer</h1>
          <p>Build your print-ready A4 document with overlays and export options.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={exportPNG} disabled={exporting || !selectedCardId}>
            🖼️ Export PNG
          </button>
          <button className="btn btn-primary" onClick={exportPDF} disabled={exporting || !selectedCardId}>
            {exporting ? <span className="spinner" /> : '📄 Export PDF'}
          </button>
        </div>
      </div>

      <div className="composer-layout">
        {/* Left sidebar controls */}
        <div className="composer-sidebar">
          {/* Card Selection */}
          <div className="composer-panel">
            <div className="composer-panel-header">
              <span className="composer-panel-title">🪪 Select Card</span>
            </div>
            <div className="composer-panel-content">
              {cards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No cards yet</p>
                  <button className="btn btn-secondary btn-sm mt-2" onClick={() => onNavigate('upload')}>
                    Upload Card
                  </button>
                </div>
              ) : (
                <select className="input" value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)}>
                  <option value="">Choose a card...</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.customType || c.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Template Selection */}
          <div className="composer-panel">
            <div className="composer-panel-header">
              <span className="composer-panel-title">📐 Template</span>
            </div>
            <div className="composer-panel-content">
              {templates.map((t) => (
                <label key={t.id} className="checkbox-group">
                  <input
                    type="radio"
                    name="template"
                    checked={!useCustomLayout && selectedTemplateId === t.id}
                    onChange={() => { setSelectedTemplateId(t.id); setUseCustomLayout(false); }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t.description}</div>
                  </div>
                </label>
              ))}

              <div className="divider" />
              
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={useCustomLayout}
                  onChange={(e) => setUseCustomLayout(e.target.checked)}
                />
                <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Advanced Configuration (Manual Layout)</span>
              </label>

              {useCustomLayout && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                  {customLayout.map((slot, index) => (
                    <div key={index} style={{ padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                      <h5 style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>
                        {slot.type} Image Layout
                      </h5>
                      <div className="range-group">
                        <label>Center X (Horizontal) <span>{slot.cx}%</span></label>
                        <input type="range" min="5" max="95" value={slot.cx} onChange={(e) => {
                          const newLayout = [...customLayout];
                          newLayout[index] = { ...slot, cx: +e.target.value };
                          setCustomLayout(newLayout);
                        }} />
                      </div>
                      <div className="range-group mt-2">
                        <label>Center Y (Vertical) <span>{slot.cy}%</span></label>
                        <input type="range" min="5" max="95" value={slot.cy} onChange={(e) => {
                          const newLayout = [...customLayout];
                          newLayout[index] = { ...slot, cy: +e.target.value };
                          setCustomLayout(newLayout);
                        }} />
                      </div>
                      <div className="range-group mt-2">
                        <label>Max Width <span>{slot.maxW}%</span></label>
                        <input type="range" min="10" max="100" value={slot.maxW} onChange={(e) => {
                          const newLayout = [...customLayout];
                          newLayout[index] = { ...slot, maxW: +e.target.value };
                          setCustomLayout(newLayout);
                        }} />
                      </div>
                      <div className="range-group mt-2">
                        <label>Max Height <span>{slot.maxH}%</span></label>
                        <input type="range" min="10" max="100" value={slot.maxH} onChange={(e) => {
                          const newLayout = [...customLayout];
                          newLayout[index] = { ...slot, maxH: +e.target.value };
                          setCustomLayout(newLayout);
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Purpose */}
          <div className="composer-panel">
            <div className="composer-panel-header">
              <span className="composer-panel-title">📝 Purpose</span>
            </div>
            <div className="composer-panel-content">
              <input
                className="input"
                type="text"
                placeholder="e.g., For LPG connection"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>

          {/* Overlays */}
          <div className="composer-panel">
            <div className="composer-panel-header">
              <span className="composer-panel-title">✏️ Overlays</span>
              <button className="btn btn-ghost btn-sm" onClick={deleteSelectedOverlay}>
                🗑️ Del
              </button>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
              {[
                { id: 'text', label: '📝 Text' },
                { id: 'qr', label: '📱 QR' },
                { id: 'sig', label: '✍️ Sign' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className="btn btn-ghost btn-sm"
                  style={{
                    flex: 1,
                    borderRadius: 0,
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="composer-panel-content">
              {activeTab === 'text' && (
                <>
                  <div className="input-group">
                    <label>Presets</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {PRESET_TEXTS.map((text) => (
                        <button
                          key={text}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 'var(--text-xs)' }}
                          onClick={() => addTextOverlay(text)}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Custom Text</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        placeholder="Enter text..."
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTextOverlay(newText)}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => addTextOverlay(newText)}>
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="range-group">
                    <label>Font Size <span>{textFontSize}px</span></label>
                    <input type="range" min={10} max={72} value={textFontSize} onChange={(e) => setTextFontSize(+e.target.value)} />
                  </div>
                  <div className="range-group">
                    <label>Opacity <span>{textOpacity}%</span></label>
                    <input type="range" min={10} max={100} value={textOpacity} onChange={(e) => setTextOpacity(+e.target.value)} />
                  </div>
                  <div className="range-group">
                    <label>Rotation <span>{textRotation}°</span></label>
                    <input type="range" min={-180} max={180} value={textRotation} onChange={(e) => setTextRotation(+e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Color</label>
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ width: 48, height: 32, border: 'none', cursor: 'pointer' }} />
                  </div>
                </>
              )}

              {activeTab === 'qr' && (
                <>
                  <div className="input-group">
                    <label>QR Content</label>
                    <textarea
                      className="input"
                      placeholder="Text or URL for QR code..."
                      value={qrText}
                      onChange={(e) => setQrText(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="range-group">
                    <label>Size <span>{qrSize}mm</span></label>
                    <input type="range" min={15} max={80} value={qrSize} onChange={(e) => setQrSize(+e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm w-full" onClick={addQrOverlay} disabled={!qrText.trim()}>
                    📱 Add QR Code
                  </button>
                </>
              )}

              {activeTab === 'sig' && (
                <>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                    Upload a transparent PNG of your signature. This is a visual signature only — not cryptographic.
                  </p>
                  <button className="btn btn-secondary btn-sm w-full" onClick={() => sigInputRef.current?.click()}>
                    ✍️ Upload Signature PNG
                  </button>
                  <input
                    ref={sigInputRef}
                    type="file"
                    accept="image/png"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) addSignatureOverlay(f);
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Export Settings */}
          <div className="composer-panel">
            <div className="composer-panel-header">
              <span className="composer-panel-title">⚙️ Export</span>
            </div>
            <div className="composer-panel-content">
              <div className="input-group">
                <label>Filter</label>
                {EXPORT_FILTERS.map((f) => (
                  <label key={f.value} className="checkbox-group">
                    <input
                      type="radio"
                      name="exportFilter"
                      checked={exportFilter === f.value}
                      onChange={() => setExportFilter(f.value)}
                    />
                    <span>{f.icon} {f.label}</span>
                  </label>
                ))}
              </div>
              {exportFilter === 'watermarked' && (
                <div className="input-group">
                  <label>Watermark Text</label>
                  <input
                    className="input"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="COPY"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="composer-canvas-area" ref={canvasContainerRef}>
          {!selectedCardId ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖨️</div>
              <h3>Select a card to begin</h3>
              <p>Choose a card from the sidebar to start composing your A4 document.</p>
            </div>
          ) : (
            <div
              className="composer-canvas-wrapper"
              style={{
                transform: `scale(${displayScale})`,
                transformOrigin: 'top center',
              }}
            >
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Utility: Apply grayscale to an image data URL
function applyGrayscale(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}
