const MAX_SIDE = 1600; // px: chekdagi yozuvlar o'qiladigan bo'lsin
const QUALITY = 0.8;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // serverdagi chegara bilan bir xil

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

/**
 * To'lov chekini (skrinshot) yuborishdan oldin kichraytiradi va JPEG ga o'giradi.
 * JPEG - Telegram adminlarga rasm sifatida muammosiz yuboradigan format.
 */
export async function compressReceipt(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // shaffof joylar oq bo'lsin
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('encode');
  return blob;
}
