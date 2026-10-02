import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

// Mahsulot rasmi bazada base64 ko'rinishida saqlanadi va shu yerdan oddiy rasm sifatida beriladi.
// Manzilda versiya bor (?v=...): rasm almashsa manzil ham o'zgaradi, shuning uchun uzoq kesh xavfsiz.
router.get('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Rasm topilmadi' });

  const product = await prisma.product.findUnique({
    where: { id },
    omit: { imageData: false },
  });
  if (!product?.imageData || !product.imageMime) return res.status(404).json({ error: 'Rasm topilmadi' });

  res.set({
    'Content-Type': product.imageMime,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.send(Buffer.from(product.imageData, 'base64'));
});

export default router;
