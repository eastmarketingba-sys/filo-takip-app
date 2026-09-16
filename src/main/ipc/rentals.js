const { ipcMain } = require('electron');
const { getSupabaseClient } = require('../supabaseClient');
const { getCurrentProfile } = require('../session');
const { archiveDeletedRental } = require('../deletedArchive');

function rowToRental(row) {
  return {
    id: row.id,
    carId: row.car_id,
    start: row.start_date,
    end: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    // Postgres "numeric" alanları PostgREST üzerinden JS'e string olarak döner
    // (ondalık hassasiyet kaybını önlemek için) - fiyat aritmetiği bozulmasın diye
    // burada açıkça sayıya çeviriyoruz.
    pricePerDay: Number(row.price_per_day),
    priceMode: row.price_mode || 'daily',
    priceTotal: row.price_total != null ? Number(row.price_total) : null,
    renterName: row.renter_name,
    renterPhone: row.renter_phone,
    renterPhoto: row.renter_photo,
    note: row.note,
    destination: row.destination,
    deliveredAt: row.delivered_at,
    deliveredNote: row.delivered_note,
    returnedAt: row.returned_at,
    returnedNote: row.returned_note
  };
}

function rentalWriteFields(data) {
  const { carId, start, end, startTime, endTime, pricePerDay, priceMode, priceTotal, renterName, renterPhone, renterPhoto, note, destination } = data || {};
  const fields = {
    start_date: start,
    end_date: end,
    start_time: startTime || null,
    end_time: endTime || null,
    price_per_day: pricePerDay,
    price_mode: priceMode || 'daily',
    price_total: priceTotal != null ? priceTotal : null,
    renter_name: renterName || null,
    renter_phone: renterPhone || null,
    renter_photo: renterPhoto || null,
    note: note || null,
    destination: destination || null
  };
  if (carId !== undefined) fields.car_id = carId;
  return fields;
}

async function updateRentalById(supabase, id, fields) {
  const { data: row, error } = await supabase.from('rentals').update(fields).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return rowToRental(row);
}

function registerRentalsIpc() {
  ipcMain.handle('rentals:list', async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('rentals').select('*').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToRental);
  });

  ipcMain.handle('rentals:add', async (event, data) => {
    const supabase = getSupabaseClient();
    const profile = getCurrentProfile();
    if (!profile) throw new Error('not_authenticated');
    const fields = rentalWriteFields(data);
    const { data: row, error } = await supabase
      .from('rentals')
      .insert({ ...fields, org_id: profile.orgId, created_by: profile.id, updated_by: profile.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:update', async (event, id, data) => {
    const supabase = getSupabaseClient();
    const profile = getCurrentProfile();
    if (!profile) throw new Error('not_authenticated');
    const fields = rentalWriteFields(data);
    delete fields.car_id; // kiralamanın hangi araca ait olduğu düzenleme ekranından değişmiyor
    fields.updated_by = profile.id;
    fields.updated_at = new Date().toISOString();
    return updateRentalById(supabase, id, fields);
  });

  ipcMain.handle('rentals:confirmDelivery', async (event, id, note) => {
    const supabase = getSupabaseClient();
    return updateRentalById(supabase, id, { delivered_at: new Date().toISOString(), delivered_note: note || null });
  });

  ipcMain.handle('rentals:confirmReturn', async (event, id, note) => {
    const supabase = getSupabaseClient();
    return updateRentalById(supabase, id, { returned_at: new Date().toISOString(), returned_note: note || null });
  });

  ipcMain.handle('rentals:undoDelivery', async (event, id) => {
    const supabase = getSupabaseClient();
    return updateRentalById(supabase, id, { delivered_at: null, delivered_note: null });
  });

  ipcMain.handle('rentals:undoReturn', async (event, id) => {
    const supabase = getSupabaseClient();
    return updateRentalById(supabase, id, { returned_at: null, returned_note: null });
  });

  ipcMain.handle('rentals:delete', async (event, id) => {
    const supabase = getSupabaseClient();
    const { data: rentalRow } = await supabase.from('rentals').select('*').eq('id', id).single();
    if (rentalRow) {
      const { data: carRow } = await supabase.from('cars').select('*').eq('id', rentalRow.car_id).single();
      archiveDeletedRental(rentalRow, carRow || null);
    }
    const { error } = await supabase.from('rentals').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  });

  // Bir kiracının fotoğrafını, adı eşleşen TÜM kiralama kayıtlarına yayar.
  // Türkçe küçük/büyük harf kuralları (ör. "İ"/"i" - "I"/"ı") normal SQL lower()'da
  // doğru çalışmadığından eşleştirme burada, eskisi gibi JS tarafında yapılıyor.
  ipcMain.handle('rentals:updateRenterPhoto', async (event, renterName, photo) => {
    const supabase = getSupabaseClient();
    const target = (renterName || '').toLocaleLowerCase('tr');
    const { data: rows, error: listErr } = await supabase.from('rentals').select('id, renter_name');
    if (listErr) throw new Error(listErr.message);
    const matchIds = (rows || [])
      .filter(r => (r.renter_name || '').toLocaleLowerCase('tr') === target)
      .map(r => r.id);
    if (matchIds.length) {
      const { error: updErr } = await supabase.from('rentals').update({ renter_photo: photo || null }).in('id', matchIds);
      if (updErr) throw new Error(updErr.message);
    }
    const { data: all, error: allErr } = await supabase.from('rentals').select('*').order('created_at', { ascending: true });
    if (allErr) throw new Error(allErr.message);
    return (all || []).map(rowToRental);
  });
}

module.exports = { registerRentalsIpc, rowToRental };
