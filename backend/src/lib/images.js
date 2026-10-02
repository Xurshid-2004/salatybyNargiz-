import multer from 'multer';
import { HttpError } from './format.js';

// Rasmlar (mahsulot rasmi, to'lov cheki) bazada base64 ko'rinishida saqlanadi.
// Mini App va Admin Panel rasmni yuborishdan oldin kichraytiradi, odatda 100-300 KB bo'ladi.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BAD_TYPE = 'Faqat JPG, PNG yoki WEBP rasm yuklang';

/** Fayl turi mijoz aytgan nomdan emas, faylning o'z boshlanishidan (magic bytes) aniqlanadi */
export function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** "image" maydonidagi bitta rasmni xotiraga o'qiydi (diskka yozilmaydi) */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new HttpError(400, BAD_TYPE))),
}).single('image');

/** Yuklangan rasmni tekshiradi: { data: base64, mime, buffer } */
export function readUploadedImage(file) {
  if (!file) throw new HttpError(400, 'Rasm tanlanmadi');
  const mime = detectImageType(file.buffer);
  if (!mime) throw new HttpError(400, BAD_TYPE);
  return { data: file.buffer.toString('base64'), mime, buffer: file.buffer };
}
