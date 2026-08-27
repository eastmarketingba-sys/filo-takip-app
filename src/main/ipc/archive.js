const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { listArchived, readArchiveEntry, removeArchiveEntry } = require('../deletedArchive');
const { rowToCar } = require('./cars');
const { rowToRental } = require('./rentals');

function registerArchiveIpc() {
  ipcMain.handle('archive:list', () => listArchived());

  ipcMain.handle('archive:restore', (event, id) => {
    const entry = readArchiveEntry(id);
    if (!entry) return { ok: false, error: 'not_found' };
    const db = getDb();

    if (entry.car) {
      const car = entry.car;
      const info = db
        .prepare('INSERT INTO cars (name, plate, photo, avg_price, note) VALUES (?, ?, ?, ?, ?)')
        .run(car.name, car.plate, car.photo, car.avg_price, car.note);
      const newCarId = info.lastInsertRowid;
      const insertRental = db.prepare(
        'INSERT INTO rentals (car_id, start_date, end_date, start_time, end_time, price_per_day, price_mode, price_total, renter_name, renter_phone, renter_photo, note, destination, delivered_at, delivered_note, returned_at, returned_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const r of entry.rentals || []) {
        insertRental.run(newCarId, r.start_date, r.end_date, r.start_time, r.end_time, r.price_per_day, r.price_mode || 'daily', r.price_total, r.renter_name, r.renter_phone, r.renter_photo, r.note, r.destination, r.delivered_at, r.delivered_note, r.returned_at, r.returned_note);
      }
      removeArchiveEntry(id);
      const row = db.prepare('SELECT * FROM cars WHERE id = ?').get(newCarId);
      return { ok: true, type: 'car', car: rowToCar(row) };
    }

    if (entry.rental) {
      const r = entry.rental;
      const carExists = r.car_id != null && db.prepare('SELECT id FROM cars WHERE id = ?').get(r.car_id);
      if (!carExists) return { ok: false, error: 'car_missing' };
      const info = db
        .prepare(
          'INSERT INTO rentals (car_id, start_date, end_date, start_time, end_time, price_per_day, price_mode, price_total, renter_name, renter_phone, renter_photo, note, destination, delivered_at, delivered_note, returned_at, returned_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(r.car_id, r.start_date, r.end_date, r.start_time, r.end_time, r.price_per_day, r.price_mode || 'daily', r.price_total, r.renter_name, r.renter_phone, r.renter_photo, r.note, r.destination, r.delivered_at, r.delivered_note, r.returned_at, r.returned_note);
      removeArchiveEntry(id);
      const row = db.prepare('SELECT * FROM rentals WHERE id = ?').get(info.lastInsertRowid);
      return { ok: true, type: 'rental', rental: rowToRental(row) };
    }

    return { ok: false, error: 'invalid_entry' };
  });

  ipcMain.handle('archive:delete', (event, id) => {
    removeArchiveEntry(id);
    return true;
  });
}

module.exports = { registerArchiveIpc };
