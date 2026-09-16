const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

// TODO: Supabase projesi oluşturulduktan sonra bu iki değeri doldurun.
// Settings -> API sayfasından: Project URL ve "anon" public key.
// Bu anon key uygulamayla birlikte dağıtılır (beklenen davranış) - service_role key BURAYA ASLA girilmemeli.
const SUPABASE_URL = 'https://ghrxjiyxedwcmvyyrclk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocnhqaXl4ZWR3Y212eXlyY2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODIyMzgsImV4cCI6MjEwMTI1ODIzOH0.kdMwWSVsSnRc4QU3RFAnuTTn0rFG_ZkRW7_RPjwWtxk';

let client = null;

function sessionFilePath() {
  return path.join(app.getPath('userData'), 'auth-session.dat');
}

function readStore() {
  const file = sessionFilePath();
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return {};
  try {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  if (!safeStorage.isEncryptionAvailable()) return;
  try {
    fs.writeFileSync(sessionFilePath(), safeStorage.encryptString(JSON.stringify(store)));
  } catch (e) {
    // oturum kalıcılığı ikincil bir işlem; başarısız olsa da uygulamayı bozmasın
  }
}

// supabase-js'nin varsayılan oturum saklama yeri (localStorage) Electron'un main
// process'inde yok. Aynı davranışı, license.dat'ta olduğu gibi safeStorage ile
// şifrelenmiş tek bir dosyaya okuyup/yazarak taklit ediyoruz.
const nodeStorageAdapter = {
  getItem: (key) => {
    const store = readStore();
    return store[key] != null ? store[key] : null;
  },
  setItem: (key, value) => {
    const store = readStore();
    store[key] = value;
    writeStore(store);
  },
  removeItem: (key) => {
    const store = readStore();
    delete store[key];
    writeStore(store);
  }
};

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: nodeStorageAdapter
      },
      // Electron'un Node çalışma zamanında global WebSocket bulunmuyor;
      // supabase-js constructor'da Realtime client'ı (kullanmasak bile) eagerly
      // oluşturuyor ve bir WebSocket implementasyonu istiyor.
      realtime: { transport: WebSocket }
    });
  }
  return client;
}

module.exports = { getSupabaseClient };
