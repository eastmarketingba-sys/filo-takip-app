const { ipcMain } = require('electron');
const { getSupabaseClient } = require('../supabaseClient');
const { getCurrentProfile } = require('../session');
const { listArchived, readArchiveEntry, removeArchiveEntry } = require('../deletedArchive');
const { rowToCar } = require('./cars');
const { rowToRental } = require('./rentals');

function registerArchiveIpc() {
  ipcMain.handle('archive:list', () => listArchived());

  ipcMain.handle('archive:restore', async (event, id) => {
    const entry = readArchiveEntry(id);
    if (!entry) return { ok: false, error: 'not_found' };
    const supabase = getSupabaseClient();
    const profile = getCurrentProfile();
    if (!profile) return { ok: false, error: 'not_authenticated' };

    if (entry.car) {
      const car = entry.car;
      const { data: newCar, error: carErr } = await supabase
        .from('cars')
        .insert({
          org_id: profile.orgId,
          name: car.name,
          plate: car.plate,
          photo: car.photo,
          avg_price: car.avg_price,
          note: car.note,
          created_by: profile.id,
          updated_by: profile.id
        })
        .select()
        .single();
      if (carErr) return { ok: false, error: carErr.message };

      const rentalsToInsert = (entry.rentals || []).map(r => ({
        org_id: profile.orgId,
        car_id: newCar.id,
        start_date: r.start_date,
        end_date: r.end_date,
        start_time: r.start_time,
        end_time: r.end_time,
        price_per_day: r.price_per_day,
        price_mode: r.price_mode || 'daily',
        price_total: r.price_total,
        renter_name: r.renter_name,
        renter_phone: r.renter_phone,
        renter_photo: r.renter_photo,
        note: r.note,
        destination: r.destination,
        delivered_at: r.delivered_at,
        delivered_note: r.delivered_note,
        returned_at: r.returned_at,
        returned_note: r.returned_note,
        created_by: profile.id,
        updated_by: profile.id
      }));
      if (rentalsToInsert.length) {
        const { error: rentalsErr } = await supabase.from('rentals').insert(rentalsToInsert);
        if (rentalsErr) return { ok: false, error: rentalsErr.message };
      }

      removeArchiveEntry(id);
      return { ok: true, type: 'car', car: rowToCar(newCar) };
    }

    if (entry.rental) {
      const r = entry.rental;
      const { data: carExists } = await supabase.from('cars').select('id').eq('id', r.car_id).single();
      if (!carExists) return { ok: false, error: 'car_missing' };
      const { data: newRental, error } = await supabase
        .from('rentals')
        .insert({
          org_id: profile.orgId,
          car_id: r.car_id,
          start_date: r.start_date,
          end_date: r.end_date,
          start_time: r.start_time,
          end_time: r.end_time,
          price_per_day: r.price_per_day,
          price_mode: r.price_mode || 'daily',
          price_total: r.price_total,
          renter_name: r.renter_name,
          renter_phone: r.renter_phone,
          renter_photo: r.renter_photo,
          note: r.note,
          destination: r.destination,
          delivered_at: r.delivered_at,
          delivered_note: r.delivered_note,
          returned_at: r.returned_at,
          returned_note: r.returned_note,
          created_by: profile.id,
          updated_by: profile.id
        })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      removeArchiveEntry(id);
      return { ok: true, type: 'rental', rental: rowToRental(newRental) };
    }

    return { ok: false, error: 'invalid_entry' };
  });

  ipcMain.handle('archive:delete', (event, id) => {
    removeArchiveEntry(id);
    return true;
  });
}

module.exports = { registerArchiveIpc };
