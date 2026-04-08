import { Router } from 'express';
import { stmts } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/templates ────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const templates = stmts.getAllTemplates.all(req.user.userId).map(t => ({
    ...t,
    isBuiltin: !!t.is_builtin,
    layout: JSON.parse(t.layout),
  }));
  res.json(templates);
});

export default router;
