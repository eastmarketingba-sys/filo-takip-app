// Satıcı tarafı script: mevcut aktivasyon kodlarını yönetir (listele / detay / sıfırla / iptal et).
//
// Kullanım:
//   node scripts/manage-codes.js list [--status unused|activated|revoked] [--search "metin"]
//   node scripts/manage-codes.js info <KOD>
//   node scripts/manage-codes.js reset <KOD>     -- kodu makineden ayırır, tekrar aktive edilebilir hale getirir
//                                                    (müşterinin bilgisayarı bozulduğunda / değiştiğinde kullanın)
//   node scripts/manage-codes.js revoke <KOD>    -- kodu kalıcı olarak iptal eder (çalınma / iade durumunda)
//   node scripts/manage-codes.js unrevoke <KOD>  -- yanlışlıkla iptal edilen bir kodu geri açar
//
// UYARI: Bu script SUPABASE_SERVICE_ROLE_KEY kullanır (RLS'i bypass eder).
// .env.admin dosyası asla git'e eklenmemeli, asla uygulamaya gömülmemeli,
// sadece sizin bilgisayarınızda kalmalı.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.admin') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Hata: .env.admin dosyasında SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.');
  console.error('Örnek için .env.admin.example dosyasına bakın.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function printRow(r) {
  console.log(`${r.code}  [${r.status}]`);
  if (r.note) console.log(`  not: ${r.note}`);
  if (r.customer_code && r.customer_code !== r.code) console.log(`  müşteri grubu: ${r.customer_code}`);
  if (r.machine_id) console.log(`  makine: ${r.machine_id}`);
  if (r.activated_at) console.log(`  aktive: ${r.activated_at}`);
  if (r.revoked_at) console.log(`  iptal: ${r.revoked_at}`);
  console.log(`  oluşturulma: ${r.created_at}`);
  console.log('');
}

async function cmdList(args) {
  let q = supabase.from('activation_codes').select('*').order('created_at', { ascending: false });
  const statusIdx = args.indexOf('--status');
  if (statusIdx !== -1) q = q.eq('status', args[statusIdx + 1]);
  const searchIdx = args.indexOf('--search');
  if (searchIdx !== -1) q = q.or(`code.ilike.%${args[searchIdx + 1]}%,note.ilike.%${args[searchIdx + 1]}%`);
  const { data, error } = await q;
  if (error) { console.error('Hata:', error.message); process.exit(1); }
  if (!data.length) { console.log('Kayıt bulunamadı.'); return; }
  console.log(`${data.length} kayıt:\n`);
  data.forEach(printRow);
}

async function cmdInfo(code) {
  if (!code) { console.error('Kullanım: node scripts/manage-codes.js info <KOD>'); process.exit(1); }
  const { data, error } = await supabase.from('activation_codes').select('*').eq('code', code).maybeSingle();
  if (error) { console.error('Hata:', error.message); process.exit(1); }
  if (!data) { console.log('Bu kod bulunamadı.'); return; }
  printRow(data);
}

async function cmdReset(code) {
  if (!code) { console.error('Kullanım: node scripts/manage-codes.js reset <KOD>'); process.exit(1); }
  const { data: existing, error: findErr } = await supabase.from('activation_codes').select('*').eq('code', code).maybeSingle();
  if (findErr) { console.error('Hata:', findErr.message); process.exit(1); }
  if (!existing) { console.log('Bu kod bulunamadı.'); return; }
  if (existing.status === 'revoked') { console.log('Bu kod iptal edilmiş, önce "unrevoke" ile geri açmalısınız.'); return; }
  const { error } = await supabase
    .from('activation_codes')
    .update({ status: 'unused', machine_id: null, activated_at: null })
    .eq('code', code);
  if (error) { console.error('Hata:', error.message); process.exit(1); }
  console.log(`✓ ${code} sıfırlandı. Müşteri aynı kodu yeni bilgisayarında tekrar girip aktive edebilir.`);
}

async function cmdRevoke(code) {
  if (!code) { console.error('Kullanım: node scripts/manage-codes.js revoke <KOD>'); process.exit(1); }
  const { error } = await supabase
    .from('activation_codes')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('code', code);
  if (error) { console.error('Hata:', error.message); process.exit(1); }
  console.log(`✓ ${code} iptal edildi. Bu kod artık hiçbir cihazda kullanılamaz.`);
}

async function cmdUnrevoke(code) {
  if (!code) { console.error('Kullanım: node scripts/manage-codes.js unrevoke <KOD>'); process.exit(1); }
  const { error } = await supabase
    .from('activation_codes')
    .update({ status: 'unused', machine_id: null, activated_at: null, revoked_at: null })
    .eq('code', code);
  if (error) { console.error('Hata:', error.message); process.exit(1); }
  console.log(`✓ ${code} tekrar kullanılabilir hale getirildi.`);
}

async function cmdGroup(code, customerCode) {
  if (!code || !customerCode) { console.error('Kullanım: node scripts/manage-codes.js group <KOD> <MUSTERI_KODU>'); process.exit(1); }
  const { error } = await supabase
    .from('activation_codes')
    .update({ customer_code: customerCode })
    .eq('code', code);
  if (error) { console.error('Hata:', error.message); process.exit(1); }
  console.log(`✓ ${code} artık "${customerCode}" müşteri grubunda. Bu gruptaki tüm cihazlar Cihaz Eşleştirme ile birbirleriyle veri paylaşabilir.`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'list') return cmdList(rest);
  if (cmd === 'info') return cmdInfo(rest[0]);
  if (cmd === 'reset') return cmdReset(rest[0]);
  if (cmd === 'revoke') return cmdRevoke(rest[0]);
  if (cmd === 'unrevoke') return cmdUnrevoke(rest[0]);
  if (cmd === 'group') return cmdGroup(rest[0], rest[1]);
  console.log(`Kullanım:
  node scripts/manage-codes.js list [--status unused|activated|revoked] [--search "metin"]
  node scripts/manage-codes.js info <KOD>
  node scripts/manage-codes.js reset <KOD>                    (müşteri bilgisayar değiştirdiğinde / bozulduğunda)
  node scripts/manage-codes.js revoke <KOD>                   (çalınma / iade)
  node scripts/manage-codes.js unrevoke <KOD>                 (yanlışlıkla iptal edilen kodu geri aç)
  node scripts/manage-codes.js group <KOD> <MUSTERI_KODU>     (bu kodu bir müşteri grubuna ekle/taşı — Cihaz Eşleştirme bu gruba göre çalışır)`);
}

main();
