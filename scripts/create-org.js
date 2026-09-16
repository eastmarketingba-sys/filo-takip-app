// Satıcı tarafı script: yeni bir müşteri için kurum (organization) kaydı açar ve
// o kurumun İLK yöneticisini (admin) e-postayla davet eder.
//
// Kullanım:
//   node scripts/create-org.js --customer MUSTERI_KODU --name "Kurum Adı" --admin-email patron@ornek.com [--admin-name "Ad Soyad"]
//
//   --customer     mint-codes.js ile o müşteriye verilen --customer değeriyle AYNI
//                  olmalı (customer_code) - aktivasyon kodları ve bulut verisi bu
//                  değer üzerinden eşleşir. Müşteriye tek bir aktivasyon kodu
//                  verildiyse (customer belirtilmeden), o kodun kendisini kullanın.
//   --name         Kurumun görünen adı (ör. şirket adı).
//   --admin-email  İlk yöneticinin e-postası - davet linki buraya gider.
//   --admin-name   (opsiyonel) İlk yöneticinin görünen adı.
//
// Bundan sonra yeni davet edilecek çalışanlar için uygulama içindeki "Ekip
// Yönetimi" ekranı kullanılır (sadece admin görebilir) - bu script sadece İLK
// admin için gerekli, çünkü davet ekranı zaten bir admin girişi ister.
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

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { customer: null, name: null, adminEmail: null, adminName: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--customer') out.customer = args[++i];
    if (args[i] === '--name') out.name = args[++i];
    if (args[i] === '--admin-email') out.adminEmail = args[++i];
    if (args[i] === '--admin-name') out.adminName = args[++i];
  }
  return out;
}

async function main() {
  const { customer, name, adminEmail, adminName } = parseArgs();
  if (!customer || !name || !adminEmail) {
    console.error('Kullanım: node scripts/create-org.js --customer MUSTERI_KODU --name "Kurum Adı" --admin-email patron@ornek.com [--admin-name "Ad Soyad"]');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: existing, error: findErr } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('customer_code', customer)
    .maybeSingle();
  if (findErr) {
    console.error('Kurum aranırken hata:', findErr.message);
    process.exit(1);
  }

  let org = existing;
  if (!org) {
    const { data: created, error: createErr } = await supabase
      .from('organizations')
      .insert({ name, customer_code: customer })
      .select('id, name')
      .single();
    if (createErr) {
      console.error('Kurum oluşturulamadı:', createErr.message);
      process.exit(1);
    }
    org = created;
    console.log(`✓ Kurum oluşturuldu: "${org.name}" (customer_code: ${customer})`);
  } else {
    console.log(`ℹ Kurum zaten mevcut: "${org.name}" (customer_code: ${customer}) - davet buna ekleniyor.`);
  }

  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(adminEmail, {
    data: { org_id: org.id, role: 'admin', display_name: adminName || null }
  });
  if (inviteErr) {
    console.error('Yönetici daveti gönderilemedi:', inviteErr.message);
    process.exit(1);
  }

  console.log(`✓ ${adminEmail} adresine yönetici daveti gönderildi.`);
}

main();
