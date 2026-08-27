const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { getSupabaseClient } = require('./supabaseClient');
const { getStoredLicense } = require('./activation');
const { getDb } = require('./db');

function tempSnapshotPath() {
  return path.join(app.getPath('temp'), `filo-takip-snapshot-${Date.now()}.db`);
}

function isValidDbFile(filePath) {
  try {
    const testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    const row = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('cars','rentals')").all();
    testDb.close();
    return row.length === 2;
  } catch (e) {
    return false;
  }
}

// Eşleştirilmiş cihazlar farklı fiziksel makineler olduğu için "id" sütunları
// bağımsız autoincrement sayaçlarından gelir ve iki tarafta aynı kaydı işaret
// etmez. Bu yüzden birleştirme sırasında kimlik eşleşmesi içerik bazlı yapılır:
// araçlar plaka (yoksa isim), kiralamalar araç+tarih+saat+kiracı adı ile.
function normalizePlate(plate) {
  const v = (plate || '').trim().toUpperCase();
  return v || null;
}
function normalizeName(name) {
  return (name || '').trim().toLocaleLowerCase('tr');
}
function carMergeKey(row) {
  const plate = normalizePlate(row.plate);
  return plate ? `P:${plate}` : `N:${normalizeName(row.name)}`;
}
function rentalMergeKey(localCarId, row) {
  return [localCarId, row.start_date, row.start_time || '', row.end_date, row.end_time || '', normalizeName(row.renter_name)].join('|');
}

// Uzak snapshot'taki araç ve kiralamaları yerel veritabanına EKLER — mevcut
// yerel kayıtları asla silmez veya üzerine yazmaz. İçerik olarak zaten var
// olan kayıtlar (aynı plaka/isim, aynı araç+tarih+kiracı) atlanır, geri kalanı
// yeni kayıt olarak eklenir.
function mergeSnapshotIntoLocal(remoteDb, localDb) {
  const result = { addedCars: 0, skippedCars: 0, addedRentals: 0, skippedRentals: 0 };

  const mergeTx = localDb.transaction(() => {
    const carIndex = new Map();
    for (const c of localDb.prepare('SELECT * FROM cars').all()) carIndex.set(carMergeKey(c), c.id);

    const insertCar = localDb.prepare(
      `INSERT INTO cars (name, plate, photo, avg_price, note, favorite, created_at, updated_at)
       VALUES (@name, @plate, @photo, @avg_price, @note, @favorite, @created_at, @updated_at)`
    );

    const carIdMap = new Map();
    for (const rc of remoteDb.prepare('SELECT * FROM cars').all()) {
      const key = carMergeKey(rc);
      const existingId = carIndex.get(key);
      if (existingId != null) {
        carIdMap.set(rc.id, existingId);
        result.skippedCars++;
      } else {
        const info = insertCar.run({
          name: rc.name, plate: rc.plate, photo: rc.photo, avg_price: rc.avg_price,
          note: rc.note, favorite: rc.favorite || 0,
          created_at: rc.created_at, updated_at: rc.updated_at
        });
        carIndex.set(key, info.lastInsertRowid);
        carIdMap.set(rc.id, info.lastInsertRowid);
        result.addedCars++;
      }
    }

    const rentalKeys = new Set();
    for (const r of localDb.prepare('SELECT * FROM rentals').all()) rentalKeys.add(rentalMergeKey(r.car_id, r));

    const insertRental = localDb.prepare(
      `INSERT INTO rentals (car_id, start_date, end_date, price_per_day, renter_name, renter_photo, created_at, start_time, end_time, renter_phone, note, destination, price_mode, price_total, delivered_at, delivered_note, returned_at, returned_note)
       VALUES (@car_id, @start_date, @end_date, @price_per_day, @renter_name, @renter_photo, @created_at, @start_time, @end_time, @renter_phone, @note, @destination, @price_mode, @price_total, @delivered_at, @delivered_note, @returned_at, @returned_note)`
    );

    for (const rr of remoteDb.prepare('SELECT * FROM rentals').all()) {
      const localCarId = carIdMap.get(rr.car_id);
      if (localCarId == null) continue;
      const key = rentalMergeKey(localCarId, rr);
      if (rentalKeys.has(key)) { result.skippedRentals++; continue; }
      insertRental.run({
        car_id: localCarId, start_date: rr.start_date, end_date: rr.end_date,
        price_per_day: rr.price_per_day, renter_name: rr.renter_name, renter_photo: rr.renter_photo,
        created_at: rr.created_at, start_time: rr.start_time, end_time: rr.end_time,
        renter_phone: rr.renter_phone, note: rr.note, destination: rr.destination,
        price_mode: rr.price_mode || 'daily', price_total: rr.price_total,
        delivered_at: rr.delivered_at, delivered_note: rr.delivered_note,
        returned_at: rr.returned_at, returned_note: rr.returned_note
      });
      rentalKeys.add(key);
      result.addedRentals++;
    }
  });
  mergeTx();

  return result;
}

// license + supabase hazırsa cihazı (yeniden) kaydeder; idempotent, kayıt zaten
// varsa sadece last_seen günceller. push/list çağrılarından önce de kullanılır
// ki açılışta kayıt bir sebeple başarısız olduysa kendi kendini onarsın.
async function ensureRegistered(license, supabase) {
  try {
    const { data, error } = await supabase.rpc('register_device', { p_code: license.code, p_machine_id: license.machineId, p_label: os.hostname() });
    if (error) return { ok: false, error: 'network', detail: error.message };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'network', detail: e.message };
  }
}

async function registerThisDevice() {
  const license = getStoredLicense();
  if (!license) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const res = await ensureRegistered(license, supabase);
  if (!res.ok) console.error('[sync] registerThisDevice failed:', JSON.stringify(res));
}

async function listSiblingDevices() {
  const license = getStoredLicense();
  if (!license) return { ok: false, error: 'not_activated' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'network' };
  const reg = await ensureRegistered(license, supabase);
  if (!reg.ok) return reg;
  try {
    const { data, error } = await supabase.rpc('list_sibling_devices', { p_code: license.code, p_machine_id: license.machineId });
    if (error) return { ok: false, error: 'network' };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };
    return { ok: true, devices: data.devices || [] };
  } catch (e) {
    return { ok: false, error: 'network' };
  }
}

async function pushSnapshot() {
  const license = getStoredLicense();
  if (!license) return { ok: false, error: 'not_activated' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'network' };
  const reg = await ensureRegistered(license, supabase);
  if (!reg.ok) return reg;

  const tmp = tempSnapshotPath();
  try {
    await getDb().backup(tmp);
    const base64 = fs.readFileSync(tmp).toString('base64');
    const { data, error } = await supabase.rpc('push_snapshot', { p_code: license.code, p_machine_id: license.machineId, p_data: base64 });
    if (error) return { ok: false, error: 'network' };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
}

async function pullSnapshot(sourceMachineId) {
  const license = getStoredLicense();
  if (!license) return { ok: false, error: 'not_activated' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'network' };
  const reg = await ensureRegistered(license, supabase);
  if (!reg.ok) return reg;

  let data, error;
  try {
    ({ data, error } = await supabase.rpc('pull_snapshot', { p_code: license.code, p_machine_id: license.machineId, p_source_machine_id: sourceMachineId }));
  } catch (e) {
    return { ok: false, error: 'network' };
  }
  if (error) return { ok: false, error: 'network' };
  if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };

  const tmp = tempSnapshotPath();
  let remoteDb;
  try {
    fs.writeFileSync(tmp, Buffer.from(data.data, 'base64'));
    if (!isValidDbFile(tmp)) return { ok: false, error: 'invalid_file' };

    remoteDb = new Database(tmp, { readonly: true, fileMustExist: true });
    const result = mergeSnapshotIntoLocal(remoteDb, getDb());
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (remoteDb) { try { remoteDb.close(); } catch (e) {} }
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
}

module.exports = { registerThisDevice, listSiblingDevices, pushSnapshot, pullSnapshot, mergeSnapshotIntoLocal };
