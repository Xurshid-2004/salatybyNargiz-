import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const menuDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'menu');

const HOMEMADE = 'Лёгкость, польза и домашний вкус — идеальный выбор к любому блюду!';
const OLIVIER = 'Классический вкус, любимый с детства — для праздничного и повседневного стола!';

// Salaty By Nargiz menyusi (Menu_Slaty_Nargiz.pdf). Narxlar - so'mda, rasmlar - prisma/menu papkasida.
// "(1 кг)" - narx 1 kg uchun: mijoz 2 ta tanlasa, 2 kg buyurtma qilgan bo'ladi.
const products = [
  // Salatlar
  { category: 'SALADS', name: 'Мимоза (1 кг)', price: 35000, image: 'mimoza.webp', description: HOMEMADE },
  { category: 'SALADS', name: 'Солёное ассорти (1 кг)', price: 40000, image: 'assorti.webp', description: HOMEMADE },
  { category: 'SALADS', name: 'Дамский каприз (1 кг)', price: 80000, image: 'damskiy-kapriz.webp', description: HOMEMADE },
  { category: 'SALADS', name: 'Фантазия (1 кг)', price: 100000, image: 'fantaziya.webp', description: '' },
  {
    category: 'SALADS',
    name: 'Цезарь (1 кг)',
    price: 90000,
    image: 'cezar.webp',
    description: 'Нежное куриное филе, хрустящие сухарики, перепелиные яйца, черри, сыр пармезан и фирменный соус.',
  },
  {
    category: 'SALADS',
    name: 'Шейх (1 кг)',
    price: 110000,
    image: 'sheykh.webp',
    description: 'Нежное сочетание говядины, шампиньонов, свежих овощей и зелени под пикантной заправкой.',
  },
  {
    category: 'SALADS',
    name: 'Сельдь под шубой (1 шт)',
    price: 100000,
    image: 'seld-pod-shuboy.webp',
    description: 'Любимая классика с нежной сельдью, овощами и слоями майонеза — вкус, проверенный временем!',
  },
  {
    category: 'SALADS',
    name: 'Бургер из баклажанов (1 шт)',
    price: 80000,
    image: 'burger-baklazhan.webp',
    description: 'Оригинальная закуска из нежных баклажанов со свежими овощами и ароматной начинкой.',
  },
  {
    category: 'SALADS',
    name: 'Витаминка (1 кг)',
    price: 60000,
    image: 'vitaminka.webp',
    description: 'Свежий, лёгкий и полезный салат из овощей — источник витаминов и хорошего настроения!',
  },
  {
    category: 'SALADS',
    name: 'Фунчоза (1 кг)',
    price: 70000,
    image: 'funchoza.webp',
    description: 'Лёгкий и ароматный салат из фунчозы и свежих овощей.',
  },
  { category: 'SALADS', name: 'Винегрет (1 кг)', price: 40000, image: 'vinegret.webp', description: HOMEMADE },
  { category: 'SALADS', name: 'Оливье с колбасой (1 кг)', price: 80000, image: 'olivye.webp', description: OLIVIER },
  { category: 'SALADS', name: 'Оливье с мясом (1 кг)', price: 100000, image: 'olivye.webp', description: OLIVIER },
  {
    category: 'SALADS',
    name: 'Мясной рай (1 кг)',
    price: 80000,
    image: 'myasnoy-ray.webp',
    description: 'Сочетание мяса и свежих овощей — настоящее удовольствие в каждой порции!',
  },
  { category: 'SALADS', name: 'Греческий салат (1 кг)', price: 80000, image: 'grecheskiy.webp', description: '' },
  { category: 'SALADS', name: 'Мужской каприз с колбасой (1 кг)', price: 80000, image: 'muzhskoy-kapriz.webp', description: '' },
  { category: 'SALADS', name: 'Мужской каприз с мясом (1 кг)', price: 100000, image: 'muzhskoy-kapriz.webp', description: '' },
  { category: 'SALADS', name: 'Рулетики из баклажанов (1 кг)', price: 80000, image: 'ruletiki.webp', description: '' },

  // Somsa va pishiriqlar
  {
    category: 'SAMSA',
    name: 'Сомса',
    price: 9000,
    image: 'somsa.webp',
    description: 'С пылу с жару! Сочная начинка, нежное тесто и аромат специй — настоящий вкус узбекской кухни.',
  },
  {
    category: 'SAMSA',
    name: 'Бичак с тыквой',
    price: 5000,
    image: 'bichak.webp',
    description: 'Мягкое тесто, сладкая тыквенная начинка и домашний вкус, который покоряет с первого кусочка!',
  },
  {
    category: 'SAMSA',
    name: 'Бодоми',
    price: 8000,
    image: 'bodomi.webp',
    description: 'Нежная слоёная выпечка с ароматной начинкой — идеальное дополнение к чаю!',
  },
];

// Birinchi versiyadagi namuna mahsulotlar (o'ylab topilgan narxlar bilan). Haqiqiy menyu kelgach yashiriladi.
// O'chirilmaydi: kerak bo'lsa Admin Panelda qayta yoqish mumkin.
const OLD_SAMPLES = [
  'Sezar salati', 'Olivye', 'Yunon salati', 'Achichuk', 'Vitaminli salat',
  "Go'shtli somsa", 'Tovuqli somsa', 'Qovoqli somsa', 'Pishloqli somsa',
  'Suv 0.5 L', 'Gazli suv 0.5 L', 'Ayron', 'Choy (ko‘k / qora)',
  'Mevali kompot 1 L', 'Olma kompoti 1 L', 'Uzum kompoti 1 L',
  'Pomidorli sous', 'Sarimsoqli sous', 'Achchiq sous', 'Qatiqli sous',
];

// Qayta ishga tushirsa bo'ladi: menyudagi mahsulot nomi bo'yicha topiladi va yangilanadi (takrorlanmaydi).
// Admin Panelda qo'shilgan boshqa mahsulotlarga tegmaydi.
async function main() {
  let created = 0;
  let updated = 0;
  for (const { image, ...data } of products) {
    const buffer = fs.readFileSync(path.join(menuDir, image));
    const version = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);

    const existing = await prisma.product.findFirst({ where: { name: data.name }, select: { id: true } });
    const { id } = existing
      ? await prisma.product.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.product.create({ data, select: { id: true } });
    if (existing) updated++;
    else created++;

    await prisma.product.update({
      where: { id },
      data: { imageData: buffer.toString('base64'), imageMime: 'image/webp', imageUrl: `/api/images/products/${id}?v=${version}` },
      select: { id: true },
    });
  }

  const hidden = await prisma.product.updateMany({
    where: { name: { in: OLD_SAMPLES }, isActive: true },
    data: { isActive: false },
  });

  console.log(`✅ Menyu yozildi: ${created} ta yangi, ${updated} ta yangilandi (rasmlari bilan).`);
  if (hidden.count) console.log(`ℹ️  ${hidden.count} ta eski namuna mahsulot yashirildi (Admin Panelda qayta yoqish mumkin).`);
}

main()
  .catch((err) => {
    console.error('❌ Seed xatosi:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
