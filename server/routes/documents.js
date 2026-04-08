import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { stmts } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Helpers to parse JSON fields coming out of SQLite
function parseDoc(doc) {
  if (!doc) return null;
  return {
    ...doc,
    overlays: doc.overlays ? JSON.parse(doc.overlays) : [],
    exportSettings: doc.export_settings ? JSON.parse(doc.export_settings) : {},
  };
}

// ── GET /api/documents ────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const docs = stmts.getDocsByUser.all(req.user.userId).map(parseDoc);
  res.json(docs);
});

// ── POST /api/documents ───────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  const { cardId, templateId, purpose, overlays, exportSettings } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });

  // Ensure card belongs to this user
  const card = stmts.getCardById.get(cardId);
  if (!card || card.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const now = Date.now();
  const doc = {
    id: uuidv4(),
    user_id: req.user.userId,
    card_id: cardId,
    template_id: templateId || null,
    purpose: purpose || null,
    overlays: JSON.stringify(overlays || []),
    export_settings: JSON.stringify(exportSettings || {}),
    created_at: now,
    updated_at: now,
  };
  stmts.createDoc.run(doc);
  res.status(201).json(parseDoc(stmts.getDocById.get(doc.id)));
});

// ── PUT /api/documents/:id ────────────────────────────────────────────────
router.put('/:id', requireAuth, (req, res) => {
  const { templateId, purpose, overlays, exportSettings } = req.body;
  const existing = stmts.getDocById.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  stmts.updateDoc.run({
    id: req.params.id,
    user_id: req.user.userId,
    template_id: templateId ?? existing.template_id,
    purpose: purpose ?? existing.purpose,
    overlays: JSON.stringify(overlays || []),
    export_settings: JSON.stringify(exportSettings || {}),
    updated_at: Date.now(),
  });
  res.json(parseDoc(stmts.getDocById.get(req.params.id)));
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const existing = stmts.getDocById.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  stmts.deleteDoc.run(req.params.id, req.user.userId);
  res.json({ message: 'Deleted' });
});

export default router;
