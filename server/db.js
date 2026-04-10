import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import process from 'node:process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_ROOT ? path.join(process.env.DATA_ROOT, 'CardManager/data') : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(DB_PATH);

// Performance tuning
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    encrypted_vault_key TEXT,
    encrypted_vault_key_iv TEXT,
    encrypted_vault_key_salt TEXT,
    recovery_encrypted_vault_key TEXT,
    recovery_encrypted_vault_key_iv TEXT,
    recovery_encrypted_vault_key_salt TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    custom_type TEXT,
    label TEXT NOT NULL,
    aspect_ratio REAL,
    front_iv TEXT NOT NULL,
    back_iv TEXT NOT NULL,
    front_thumb_iv TEXT NOT NULL,
    back_thumb_iv TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    user_id TEXT,
    layout TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    template_id TEXT,
    purpose TEXT,
    overlays TEXT,
    export_settings TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
  );
`);

// Lightweight migrations for existing databases.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('encrypted_vault_key')) {
  db.exec('ALTER TABLE users ADD COLUMN encrypted_vault_key TEXT');
}
if (!userColumns.includes('encrypted_vault_key_iv')) {
  db.exec('ALTER TABLE users ADD COLUMN encrypted_vault_key_iv TEXT');
}
if (!userColumns.includes('encrypted_vault_key_salt')) {
  db.exec('ALTER TABLE users ADD COLUMN encrypted_vault_key_salt TEXT');
}
if (!userColumns.includes('recovery_encrypted_vault_key')) {
  db.exec('ALTER TABLE users ADD COLUMN recovery_encrypted_vault_key TEXT');
}
if (!userColumns.includes('recovery_encrypted_vault_key_iv')) {
  db.exec('ALTER TABLE users ADD COLUMN recovery_encrypted_vault_key_iv TEXT');
}
if (!userColumns.includes('recovery_encrypted_vault_key_salt')) {
  db.exec('ALTER TABLE users ADD COLUMN recovery_encrypted_vault_key_salt TEXT');
}

// ── Built-in Templates ───────────────────────────────────────────────────
const BUILTIN_TEMPLATES = [
  {
    id: 'tpl-standard-vertical',
    name: 'Standard Vertical',
    description: 'Front on top (25%), back on bottom (75%)',
    is_builtin: 1,
    layout: JSON.stringify({
      pageSize: 'A4', orientation: 'portrait',
      slots: [
        { type: 'front', cx: 50, cy: 25, maxW: 90, maxH: 45 },
        { type: 'back',  cx: 50, cy: 75, maxW: 90, maxH: 45 },
      ],
    }),
  },
  {
    id: 'tpl-side-by-side',
    name: 'Side by Side',
    description: 'Front left (25%), back right (75%)',
    is_builtin: 1,
    layout: JSON.stringify({
      pageSize: 'A4', orientation: 'portrait',
      slots: [
        { type: 'front', cx: 25, cy: 50, maxW: 45, maxH: 90 },
        { type: 'back',  cx: 75, cy: 50, maxW: 45, maxH: 90 },
      ],
    }),
  },
  {
    id: 'tpl-compact',
    name: 'Compact (Centered)',
    description: 'Smaller card prints clustered in center',
    is_builtin: 1,
    layout: JSON.stringify({
      pageSize: 'A4', orientation: 'portrait',
      slots: [
        { type: 'front', cx: 50, cy: 35, maxW: 60, maxH: 25 },
        { type: 'back',  cx: 50, cy: 65, maxW: 60, maxH: 25 },
      ],
    }),
  },
];

const upsertTemplate = db.prepare(`
  INSERT INTO templates (id, name, description, is_builtin, layout)
  VALUES (@id, @name, @description, @is_builtin, @layout)
  ON CONFLICT(id) DO UPDATE SET
    name        = excluded.name,
    description = excluded.description,
    layout      = excluded.layout
`);

// Remove orphaned builtins
const validBuiltinIds = BUILTIN_TEMPLATES.map(t => t.id);
const existingBuiltins = db.prepare('SELECT id FROM templates WHERE is_builtin = 1').all();
for (const { id } of existingBuiltins) {
  if (!validBuiltinIds.includes(id)) {
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  }
}
// Upsert current builtins
for (const tpl of BUILTIN_TEMPLATES) upsertTemplate.run(tpl);

// ── Prepared statements ──────────────────────────────────────────────────
export const stmts = {
  // Users
  getUserById:       db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  createUser:        db.prepare(`
    INSERT INTO users (
      id, username, password_hash, salt, recovery_hash,
      encrypted_vault_key, encrypted_vault_key_iv, encrypted_vault_key_salt,
      recovery_encrypted_vault_key, recovery_encrypted_vault_key_iv, recovery_encrypted_vault_key_salt,
      created_at
    )
    VALUES (
      @id, @username, @password_hash, @salt, @recovery_hash,
      @encrypted_vault_key, @encrypted_vault_key_iv, @encrypted_vault_key_salt,
      @recovery_encrypted_vault_key, @recovery_encrypted_vault_key_iv, @recovery_encrypted_vault_key_salt,
      @created_at
    )
  `),
  updatePassword:    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  updateEncryptedVaultKey: db.prepare(`
    UPDATE users
    SET
      encrypted_vault_key = ?, encrypted_vault_key_iv = ?, encrypted_vault_key_salt = ?,
      recovery_encrypted_vault_key = ?, recovery_encrypted_vault_key_iv = ?, recovery_encrypted_vault_key_salt = ?
    WHERE id = ?
  `),

  // Cards
  getCardsByUser: db.prepare('SELECT id, user_id, type, custom_type, label, aspect_ratio, front_iv, back_iv, front_thumb_iv, back_thumb_iv, created_at, updated_at FROM cards WHERE user_id = ? ORDER BY created_at DESC'),
  getCardById:    db.prepare('SELECT id, user_id, type, custom_type, label, aspect_ratio, front_iv, back_iv, front_thumb_iv, back_thumb_iv, created_at, updated_at FROM cards WHERE id = ?'),
  createCard:     db.prepare(`
    INSERT INTO cards (id, user_id, type, custom_type, label, aspect_ratio, front_iv, back_iv, front_thumb_iv, back_thumb_iv, created_at, updated_at)
    VALUES (@id, @user_id, @type, @custom_type, @label, @aspect_ratio, @front_iv, @back_iv, @front_thumb_iv, @back_thumb_iv, @created_at, @updated_at)
  `),
  deleteCard:     db.prepare('DELETE FROM cards WHERE id = ?'),

  // Templates
  getAllTemplates: db.prepare('SELECT * FROM templates WHERE is_builtin = 1 OR user_id = ?'),

  // Documents
  getDocsByUser:  db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC'),
  getDocById:     db.prepare('SELECT * FROM documents WHERE id = ?'),
  createDoc:      db.prepare(`
    INSERT INTO documents (id, user_id, card_id, template_id, purpose, overlays, export_settings, created_at, updated_at)
    VALUES (@id, @user_id, @card_id, @template_id, @purpose, @overlays, @export_settings, @created_at, @updated_at)
  `),
  updateDoc:      db.prepare(`
    UPDATE documents SET template_id = @template_id, purpose = @purpose,
      overlays = @overlays, export_settings = @export_settings, updated_at = @updated_at
    WHERE id = @id AND user_id = @user_id
  `),
  deleteDoc:      db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?'),
};

export { DATA_DIR };
export default db;
