import express, { Router } from 'express';
import { handlePayme } from '../lib/payme.js';
import { handleClick } from '../lib/click.js';

// Bu manzillarni mijoz emas, Payme va Click serverlari chaqiradi.
// Ular kabinetda ro'yxatdan o'tkaziladi (README ga qarang).
const router = Router();

// Payme: JSON-RPC. Body'ni o'zimiz o'qiymiz, shunda noto'g'ri JSON ga ham Payme formatida javob beramiz.
router.post('/payme', express.text({ type: () => true, limit: '64kb' }), async (req, res) => {
  const raw = typeof req.body === 'string' ? req.body : '';
  res.json(await handlePayme(req.get('authorization'), raw));
});

// Click: application/x-www-form-urlencoded
const clickBody = [express.urlencoded({ extended: false, limit: '16kb' }), express.json({ limit: '16kb' })];
router.post('/click/prepare', clickBody, async (req, res) => res.json(await handleClick(req.body, 0)));
router.post('/click/complete', clickBody, async (req, res) => res.json(await handleClick(req.body, 1)));

export default router;
