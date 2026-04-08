import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { stmts, DATA_DIR } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Memory storage — we store encrypted bytes directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per image
  fileFilter: (req, file, cb) => {
    // Encrypted uploads are expected to be opaque bytes.
    // We cannot validate original image types after encryption.
    const okTypes = new Set(['application/octet-stream']);
    if (!okTypes.has(file.mimetype)) {
      return cb(new Error('Invalid encrypted upload type'));
    }
    cb(null, true);
  },
});

function cardDir(userId, cardId) {
  const dir = path.join(DATA_DIR, 'uploads', userId, cardId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function streamImage(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  const mime = 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
}

// ── GET /api/cards ────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const cards = stmts.getCardsByUser.all(req.user.userId);
  res.json(cards);
});

// ── POST /api/cards ───────────────────────────────────────────────────────
router.post('/', requireAuth, upload.fields([
  { name: 'frontImg', maxCount: 1 },
  { name: 'backImg', maxCount: 1 },
  { name: 'frontThumb', maxCount: 1 },
  { name: 'backThumb', maxCount: 1 }
]), async (req, res) => {
  const { type, customType, label, aspectRatio, frontIv, backIv, frontThumbIv, backThumbIv } = req.body;
  
  if (!type || !label || !frontIv || !backIv || !frontThumbIv || !backThumbIv) {
    return res.status(400).json({ error: 'Missing required metadata or IVs' });
  }
  if (!req.files?.frontImg || !req.files?.backImg || !req.files?.frontThumb || !req.files?.backThumb) {
    return res.status(400).json({ error: 'All 4 encrypted image files are required' });
  }

  const cardId = uuidv4();
  const userId = req.user.userId;
  const dir = cardDir(userId, cardId);

  // Directly save encrypted raw binary buffers to disk
  fs.writeFileSync(path.join(dir, 'front.enc'), req.files.frontImg[0].buffer);
  fs.writeFileSync(path.join(dir, 'back.enc'), req.files.backImg[0].buffer);
  fs.writeFileSync(path.join(dir, 'front_thumb.enc'), req.files.frontThumb[0].buffer);
  fs.writeFileSync(path.join(dir, 'back_thumb.enc'), req.files.backThumb[0].buffer);

  const now = Date.now();
  stmts.createCard.run({
    id: cardId,
    user_id: userId,
    type,
    custom_type: customType || null,
    label,
    aspect_ratio: parseFloat(aspectRatio || 1.586),
    front_iv: frontIv,
    back_iv: backIv,
    front_thumb_iv: frontThumbIv,
    back_thumb_iv: backThumbIv,
    created_at: now,
    updated_at: now,
  });

  res.status(201).json(stmts.getCardById.get(cardId));
});

// ── GET /api/cards/:id  (metadata only) ──────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const card = stmts.getCardById.get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Not found' });
  if (card.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  res.json(card);
});

// ── Image streaming endpoints ─────────────────────────────────────────────
function imageHandler(side, thumb = false) {
  return (req, res) => {
    const card = stmts.getCardById.get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    if (card.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    const filename = thumb ? `${side}_thumb.enc` : `${side}.enc`;
    streamImage(res, path.join(DATA_DIR, 'uploads', card.user_id, card.id, filename));
  };
}

router.get('/:id/front',       requireAuth, imageHandler('front'));
router.get('/:id/back',        requireAuth, imageHandler('back'));
router.get('/:id/front/thumb', requireAuth, imageHandler('front', true));
router.get('/:id/back/thumb',  requireAuth, imageHandler('back', true));

// ── DELETE /api/cards/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  const card = stmts.getCardById.get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Not found' });
  if (card.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  // Remove files from disk
  const dir = path.join(DATA_DIR, 'uploads', card.user_id, card.id);
  fs.rmSync(dir, { recursive: true, force: true });

  stmts.deleteCard.run(card.id);
  res.json({ message: 'Deleted' });
});

export default router;
