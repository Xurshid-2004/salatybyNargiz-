const MAX_SIDE = 1280; // px, eng katta tomoni
const QUALITY = 0.82;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // serverdagi chegara bilan bir xil
const SAFE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
      reject(new Error("Rasmni o'qib bo'lmadi. JPG, PNG yoki WEBP rasm tanlang"));
    };
    img.src = url;
  });
}

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));

/**
 * Rasmni yuborishdan oldin kichraytiradi: eng katta tomoni 1280px, WEBP (bo'lmasa JPEG).
 * Rasm bazada base64 saqlanadi: hajm qancha kichik bo'lsa, menyu shuncha tez ochiladi.
 */
export async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  let blob = await toBlob(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') {
    // Eski Safari WEBP yoza olmaydi: JPEG ga o'tamiz, shaffof joylar oq bo'ladi
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    blob = await toBlob(canvas, 'image/jpeg');
  }
  if (!blob) throw new Error("Rasmni tayyorlab bo'lmadi");

  // Asl fayl kichik va siqilgandan ham yengil bo'lsa, o'zini yuboramiz
  if (scale === 1 && SAFE_TYPES.includes(file.type) && file.size <= blob.size) return file;
  return blob;
}
