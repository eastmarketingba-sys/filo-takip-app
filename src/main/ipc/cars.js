const { ipcMain } = require('electron');
const { getSupabaseClient } = require('../supabaseClient');
const { getCurrentProfile } = require('../session');
const { archiveDeletedCar } = require('../deletedArchive');

function rowToCar(row) {
  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    photo: row.photo,
    // Postgres'in "numeric" tipi, ondalık hassasiyet kaybı olmasın diye PostgREST
    // üzerinden JS'e STRING olarak döner - renderer'daki fiyat aritmetiği bozulmasın
    // diye burada açıkça sayıya çeviriyoruz.
    avgPrice: row.avg_price != null ? Number(row.avg_price) : null,
    note: row.note,
    favorite: !!row.favorite
  };
}

function registerCarsIpc() {
  ipcMain.handle('cars:list', async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('cars').select('*').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToCar);
  });

  ipcMain.handle('cars:add', async (event, data) => {
    const supabase = getSupabaseClient();
    const profile = getCurrentProfile();
    if (!profile) throw new Error('not_authenticated');
    const { name, plate, photo, avgPrice, note } = data || {};
    const { data: row, error } = await supabase
      .from('cars')
      .insert({
        org_id: profile.orgId,
        name,
        plate: plate || null,
        photo: photo || null,
        avg_price: avgPrice != null ? avgPrice : null,
        note: note || null,
        created_by: profile.id,
        updated_by: profile.id
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToCar(row);
  });

  ipcMain.handle('cars:update', async (event, id, patch) => {
    const supabase = getSupabaseClient();
    const profile = getCurrentProfile();
    if (!profile) throw new Error('not_authenticated');
    patch = patch || {};
    const updates = { updated_by: profile.id, updated_at: new Date().toISOString() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.plate !== undefined) updates.plate = patch.plate;
    if (patch.photo !== undefined) updates.photo = patch.photo;
    if (patch.avgPrice !== undefined) updates.avg_price = patch.avgPrice;
    if (patch.note !== undefined) updates.note = patch.note;
    if (patch.favorite !== undefined) updates.favorite = !!patch.favorite;
    const { data: row, error } = await supabase.from('cars').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return rowToCar(row);
  });

  ipcMain.handle('cars:delete', async (event, id) => {
    const supabase = getSupabaseClient();
    const { data: carRow } = await supabase.from('cars').select('*').eq('id', id).single();
    if (carRow) {
      const { data: rentalRows } = await supabase.from('rentals').select('*').eq('car_id', id);
      archiveDeletedCar(carRow, rentalRows || []);
    }
    // Silme yetkisi RLS'te admin ile sınırlı (bkz. supabase/orgs_and_auth.sql,
    // cars_delete policy) - admin olmayan bir çağrı burada hata alır.
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  });
}

module.exports = { registerCarsIpc, rowToCar };
