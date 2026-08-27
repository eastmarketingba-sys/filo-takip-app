// Satıcı tarafı script: yeni aktivasyon kodları üretir.
// Kullanım: node scripts/mint-codes.js --count 10
//   --note "Müşteri Adı"       (opsiyonel, sadece etiket/hatırlatma amaçlı)
//   --customer MUSTERI_KODU    (opsiyonel; verilirse bu kodlar aynı müşteri
//                                grubuna girer ve "Cihaz Eşleştirme" özelliğiyle
//                                birbirleriyle veri paylaşabilir/getirebilir.
//                                Aynı müşteriye SONRADAN yeni kod eklemek için
//                                aynı --customer değerini tekrar kullanın.
//                                Verilmezse her kod kendi başına izole bir kod
//                                olarak üretilir, tek bilgisayar için yeterlidir.)
//
// UYARI: Bu script SUPABASE_SERVICE_ROLE_KEY kullanır (RLS'i bypass eder).
// .env.admin dosyası asla git'e eklenmemeli, asla uygulamaya gömülmemeli,
// sadece sizin bilgisayarınızda kalmalı.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.admin') });
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Hata: .env.admin dosyasında SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.');
  console.error('Örnek için .env.admin.example dosyasına bakın.');
  process.exit(1);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I gibi karışabilecek karakterler çıkarıldı

function randomGroup(len) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function generateCode() {
  return `FILO-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let count = 1;
  let note = null;
  let customer = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count') count = parseInt(args[++i], 10) || 1;
    if (args[i] === '--note') note = args[++i];
    if (args[i] === '--customer') customer = args[++i];
  }
  return { count, note, customer };
}

async function main() {
  const { count, note, customer } = parseArgs();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const minted = [];
  for (let i = 0; i < count; i++) {
    let inserted = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const code = generateCode();
      const { data, error } = await supabase
        .from('activation_codes')
        .insert({ code, note, customer_code: customer || code })
        .select('code')
        .single();
      if (!error) {
        inserted = data;
      } else if (!String(error.message || '').includes('duplicate')) {
        console.error('Kod eklenemedi:', error.message);
        process.exit(1);
      }
    }
    if (inserted) minted.push(inserted.code);
  }

  console.log(`${minted.length} aktivasyon kodu oluşturuldu${customer ? ` (müşteri grubu: ${customer})` : ''}:\n`);
  minted.forEach(c => console.log(c));
}

main();
