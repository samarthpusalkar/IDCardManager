import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { stmts, DATA_DIR } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Memory storage — we process with sharp then write manually
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
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
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
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
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 },
]), async (req, res) => {
  const { type, customType, label } = req.body;
  if (!type || !label) {
    return res.status(400).json({ error: 'type and label are required' });
  }
  if (!req.files?.front || !req.files?.back) {
    return res.status(400).json({ error: 'Both front and back images are required' });
  }

  const cardId = uuidv4();
  const userId = req.user.userId;
  const dir = cardDir(userId, cardId);

  // Process images: save full-quality JPEG + thumbnail
  const frontBuf = req.files.front[0].buffer;
  const backBuf  = req.files.back[0].buffer;

  const [frontMeta] = await Promise.all([
    sharp(frontBuf).jpeg({ quality: 90 }).toFile(path.join(dir, 'front.jpg')),
    sharp(backBuf).jpeg({ quality: 90 }).toFile(path.join(dir, 'back.jpg')),
    sharp(frontBuf).resize(400).jpeg({ quality: 70 }).toFile(path.join(dir, 'front_thumb.jpg')),
    sharp(backBuf).resize(400).jpeg({ quality: 70 }).toFile(path.join(dir, 'back_thumb.jpg')),
  ]);

  // Compute aspect ratio from front image
  const frontInfo = await sharp(frontBuf).metadata();
  const aspectRatio = frontInfo.width / frontInfo.height;

  const now = Date.now();
  stmts.createCard.run({
    id: cardId,
    user_id: userId,
    type,
    custom_type: customType || null,
    label,
    aspect_ratio: aspectRatio,
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
    const filename = thumb ? `${side}_thumb.jpg` : `${side}.jpg`;
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
