import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function checkAdminPassword(password) {
  return crypto.timingSafeEqual(sha(password), sha(config.adminPassword));
}

export function signAdminToken() {
  return jwt.sign({ role: 'admin' }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '12h' });
}

/** Admin API himoyasi. SSE (EventSource) sarlavha yubora olmagani uchun allowQuery ishlatiladi. */
export function adminAuth({ allowQuery = false } = {}) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : allowQuery ? req.query.token : null;
    try {
      const payload = jwt.verify(String(token), config.jwtSecret, { algorithms: ['HS256'] });
      if (payload.role !== 'admin') throw new Error('role');
      next();
    } catch {
      res.status(401).json({ error: 'Kirish talab qilinadi' });
    }
  };
}
