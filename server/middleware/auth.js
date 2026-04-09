import jwt from 'jsonwebtoken';
import process from 'node:process';
import { stmts } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cardcomposer-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '180d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = stmts.getUserById.get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
