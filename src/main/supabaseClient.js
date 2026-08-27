const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

// TODO: Supabase projesi oluşturulduktan sonra bu iki değeri doldurun.
// Settings -> API sayfasından: Project URL ve "anon" public key.
// Bu anon key uygulamayla birlikte dağıtılır (beklenen davranış) - service_role key BURAYA ASLA girilmemeli.
const SUPABASE_URL = 'https://ghrxjiyxedwcmvyyrclk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocnhqaXl4ZWR3Y212eXlyY2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODIyMzgsImV4cCI6MjEwMTI1ODIzOH0.kdMwWSVsSnRc4QU3RFAnuTTn0rFG_ZkRW7_RPjwWtxk';

let client = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      // Electron'un Node çalışma zamanında global WebSocket bulunmuyor;
      // supabase-js constructor'da Realtime client'ı (kullanmasak bile) eagerly
      // oluşturuyor ve bir WebSocket implementasyonu istiyor.
      realtime: { transport: WebSocket }
    });
  }
  return client;
}

module.exports = { getSupabaseClient };
