import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { stmts } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = stmts.getUserById.get(req.user.userId);
  if (!user) {
    return res.status(401).json({ error: 'Account no longer exists' });
  }
  res.json({
    user: { id: user.id, username: user.username },
    encryptedVaultKey: user.encrypted_vault_key,
    encryptedVaultKeyIv: user.encrypted_vault_key_iv,
    encryptedVaultKeySalt: user.encrypted_vault_key_salt,
  });
});

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

  // Unique salt per user for deriving their locally secure Vault Key
  const salt = uuidv4().replace(/-/g, '');

  const [passHash, recoveryHash] = await Promise.all([
    bcrypt.hash(password, 12),
    bcrypt.hash(recoveryCode, 12),
  ]);

  const user = {
    id: uuidv4(),
    username: trimmed,
    password_hash: passHash,
    salt,
    recovery_hash: recoveryHash,
    encrypted_vault_key: null,
    encrypted_vault_key_iv: null,
    encrypted_vault_key_salt: null,
    recovery_encrypted_vault_key: null,
    recovery_encrypted_vault_key_iv: null,
    recovery_encrypted_vault_key_salt: null,
    created_at: Date.now(),
  };

  stmts.createUser.run(user);

  const token = signToken({ userId: user.id, username: user.username });
  res.status(201).json({
    token,
    user: { id: user.id, username: user.username },
    salt: user.salt,
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
  if (!user.encrypted_vault_key || !user.encrypted_vault_key_iv || !user.encrypted_vault_key_salt) {
    return res.status(409).json({ error: 'Vault is not initialized. Please recover account.' });
  }
  res.json({
    token,
    user: { id: user.id, username: user.username },
    salt: user.salt,
    encryptedVaultKey: user.encrypted_vault_key,
    encryptedVaultKeyIv: user.encrypted_vault_key_iv,
    encryptedVaultKeySalt: user.encrypted_vault_key_salt,
  });
});

// ── PUT /api/auth/vault-key ──────────────────────────────────────────────
router.put('/vault-key', requireAuth, async (req, res) => {
  const {
    encryptedVaultKey,
    encryptedVaultKeyIv,
    encryptedVaultKeySalt,
    recoveryEncryptedVaultKey,
    recoveryEncryptedVaultKeyIv,
    recoveryEncryptedVaultKeySalt,
  } = req.body;
  if (!encryptedVaultKey || !encryptedVaultKeyIv || !encryptedVaultKeySalt) {
    return res.status(400).json({ error: 'Missing vault key payload' });
  }
  if (!recoveryEncryptedVaultKey || !recoveryEncryptedVaultKeyIv || !recoveryEncryptedVaultKeySalt) {
    return res.status(400).json({ error: 'Missing recovery vault key payload' });
  }

  const user = stmts.getUserById.get(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  stmts.updateEncryptedVaultKey.run(
    encryptedVaultKey,
    encryptedVaultKeyIv,
    encryptedVaultKeySalt,
    recoveryEncryptedVaultKey,
    recoveryEncryptedVaultKeyIv,
    recoveryEncryptedVaultKeySalt,
    user.id
  );
  res.json({ message: 'Vault key updated' });
});

// ── GET /api/auth/salt ───────────────────────────────────────────────────
router.get('/salt', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const user = stmts.getUserByUsername.get(username.trim().toLowerCase());
  if (!user) {
    // Return a fake salt to prevent username enumeration attacks
    return res.json({ salt: '00000000000000000000000000000000' });
  }

  res.json({ salt: user.salt });
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
  if (!user.recovery_encrypted_vault_key || !user.recovery_encrypted_vault_key_iv || !user.recovery_encrypted_vault_key_salt) {
    return res.status(409).json({ error: 'Recovery vault data missing. Cannot reset without data loss.' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  stmts.updatePassword.run(newHash, user.id);
  const token = signToken({ userId: user.id, username: user.username });
  res.json({
    message: 'Password reset successfully.',
    token,
    user: { id: user.id, username: user.username },
    recoveryEncryptedVaultKey: user.recovery_encrypted_vault_key,
    recoveryEncryptedVaultKeyIv: user.recovery_encrypted_vault_key_iv,
    recoveryEncryptedVaultKeySalt: user.recovery_encrypted_vault_key_salt,
  });
});

export default router;
