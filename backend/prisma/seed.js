import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Narxlar - so'mda. Keyin Admin Panel orqali o'zgartirasiz.
const products = [
  // Salatlar
  { category: 'SALADS', name: 'Sezar salati', description: 'Tovuq, romen salat, parmezan, krutonlar, sezar sousi', price: 38000 },
  { category: 'SALADS', name: 'Olivye', description: 'Klassik olivye: kartoshka, sabzi, tuxum, bodring, mayonez', price: 26000 },
  { category: 'SALADS', name: 'Yunon salati', description: 'Pomidor, bodring, bulg‘ori qalampiri, zaytun, feta pishlog‘i', price: 32000 },
  { category: 'SALADS', name: 'Achichuk', description: 'Yangi pomidor, piyoz va rayhon', price: 14000 },
  { category: 'SALADS', name: 'Vitaminli salat', description: 'Karam, sabzi, bodring va zaytun moyi', price: 18000 },

  // Somsalar
  { category: 'SAMSA', name: "Go'shtli somsa", description: "Tandirda pishgan, mol go'shti va piyozli", price: 12000 },
  { category: 'SAMSA', name: 'Tovuqli somsa', description: 'Yumshoq tovuq go‘shti va kartoshkali', price: 11000 },
  { category: 'SAMSA', name: 'Qovoqli somsa', description: 'Qovoq va piyozli, sershira', price: 9000 },
  { category: 'SAMSA', name: 'Pishloqli somsa', description: 'Erigan pishloq va ko‘katli', price: 10000 },

  // Ichimliklar
  { category: 'DRINKS', name: 'Suv 0.5 L', description: 'Gazsiz ichimlik suvi', price: 3000 },
  { category: 'DRINKS', name: 'Gazli suv 0.5 L', description: 'Gazlangan mineral suv', price: 4000 },
  { category: 'DRINKS', name: 'Ayron', description: 'Sovuq, tabiiy ayron', price: 7000 },
  { category: 'DRINKS', name: 'Choy (ko‘k / qora)', description: 'Choynakda, limon bilan', price: 8000 },

  // Kompot
  { category: 'COMPOT', name: 'Mevali kompot 1 L', description: 'Quritilgan mevalardan uy kompoti', price: 16000 },
  { category: 'COMPOT', name: 'Olma kompoti 1 L', description: 'Yangi olmadan tayyorlangan', price: 15000 },
  { category: 'COMPOT', name: 'Uzum kompoti 1 L', description: 'Shirin uzum kompoti', price: 16000 },

  // Yangi souslar
  { category: 'SAUCES', name: 'Pomidorli sous', description: 'Yangi pomidor, sarimsoq va ko‘katli', price: 6000 },
  { category: 'SAUCES', name: 'Sarimsoqli sous', description: 'Qaymoq va sarimsoq asosida', price: 6000 },
  { category: 'SAUCES', name: 'Achchiq sous', description: 'Qizil qalampirli, o‘tkir', price: 6000 },
  { category: 'SAUCES', name: 'Qatiqli sous', description: 'Bodring, qatiq va ukrop bilan', price: 6000 },
];

async function main() {
  const count = await prisma.product.count();
  if (count > 0) {
    console.log(`ℹ️  Bazada ${count} ta mahsulot bor, seed o'tkazib yuborildi.`);
    return;
  }
  await prisma.product.createMany({ data: products });
  console.log(`✅ ${products.length} ta boshlang'ich mahsulot bazaga yozildi.`);
}

main()
  .catch((err) => {
    console.error("❌ Seed xatosi:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
