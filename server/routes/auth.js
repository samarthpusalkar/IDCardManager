import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { stmts } from '../db.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

// ── POST /api/auth/register ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const trimmed = username.trim().toLowerCase();
  const existing = stmts.getUserByUsername.get(trimmed);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  // Generate recovery code (shown once, never stored in plain text)
  const recoveryCode = `${uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()}-${uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()}-${uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

  const [passHash, recoveryHash] = await Promise.all([
    bcrypt.hash(password, 12),
    bcrypt.hash(recoveryCode, 12),
  ]);

  const user = {
    id: uuidv4(),
    username: trimmed,
    password_hash: passHash,
    recovery_hash: recoveryHash,
    created_at: Date.now(),
  };

  stmts.createUser.run(user);

  const token = signToken({ userId: user.id, username: user.username });
  res.status(201).json({
    token,
    user: { id: user.id, username: user.username },
    recoveryCode, // shown once on frontend, never sent again
  });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = stmts.getUserByUsername.get(username.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// ── POST /api/auth/recover ───────────────────────────────────────────────
router.post('/recover', async (req, res) => {
  const { username, recoveryCode, newPassword } = req.body;
  if (!username || !recoveryCode || !newPassword) {
    return res.status(400).json({ error: 'username, recoveryCode, and newPassword are required' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  const user = stmts.getUserByUsername.get(username.trim().toLowerCase());
  if (!user) {
    // Don't reveal if user exists
    return res.status(400).json({ error: 'Invalid username or recovery code' });
  }

  const valid = await bcrypt.compare(recoveryCode.trim().toUpperCase(), user.recovery_hash);
  if (!valid) {
    return res.status(400).json({ error: 'Invalid username or recovery code' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  stmts.updatePassword.run(newHash, user.id);

  res.json({ message: 'Password reset successfully. Please log in.' });
});

export default router;
