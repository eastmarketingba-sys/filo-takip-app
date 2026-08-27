const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { archiveDeletedRental } = require('../deletedArchive');

function rowToRental(row) {
  return {
    id: String(row.id),
    carId: String(row.car_id),
    start: row.start_date,
    end: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    pricePerDay: row.price_per_day,
    priceMode: row.price_mode || 'daily',
    priceTotal: row.price_total,
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

function registerRentalsIpc() {
  ipcMain.handle('rentals:list', () => {
    const rows = getDb().prepare('SELECT * FROM rentals ORDER BY id ASC').all();
    return rows.map(rowToRental);
  });

  ipcMain.handle('rentals:add', (event, data) => {
    const { carId, start, end, startTime, endTime, pricePerDay, priceMode, priceTotal, renterName, renterPhone, renterPhoto, note, destination } = data || {};
    const info = getDb()
      .prepare(
        'INSERT INTO rentals (car_id, start_date, end_date, start_time, end_time, price_per_day, price_mode, price_total, renter_name, renter_phone, renter_photo, note, destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(carId, start, end, startTime || null, endTime || null, pricePerDay, priceMode || 'daily', priceTotal != null ? priceTotal : null, renterName || null, renterPhone || null, renterPhoto || null, note || null, destination || null);
    const row = getDb().prepare('SELECT * FROM rentals WHERE id = ?').get(info.lastInsertRowid);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:update', (event, id, data) => {
    const { start, end, startTime, endTime, pricePerDay, priceMode, priceTotal, renterName, renterPhone, renterPhoto, note, destination } = data || {};
    getDb()
      .prepare(
        'UPDATE rentals SET start_date = ?, end_date = ?, start_time = ?, end_time = ?, price_per_day = ?, price_mode = ?, price_total = ?, renter_name = ?, renter_phone = ?, renter_photo = ?, note = ?, destination = ? WHERE id = ?'
      )
      .run(start, end, startTime || null, endTime || null, pricePerDay, priceMode || 'daily', priceTotal != null ? priceTotal : null, renterName || null, renterPhone || null, renterPhoto || null, note || null, destination || null, id);
    const row = getDb().prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:confirmDelivery', (event, id, note) => {
    getDb().prepare(`UPDATE rentals SET delivered_at = datetime('now'), delivered_note = ? WHERE id = ?`).run(note || null, id);
    const row = getDb().prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:confirmReturn', (event, id, note) => {
    getDb().prepare(`UPDATE rentals SET returned_at = datetime('now'), returned_note = ? WHERE id = ?`).run(note || null, id);
    const row = getDb().prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:undoDelivery', (event, id) => {
    getDb().prepare(`UPDATE rentals SET delivered_at = NULL, delivered_note = NULL WHERE id = ?`).run(id);
    const row = getDb().prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:undoReturn', (event, id) => {
    getDb().prepare(`UPDATE rentals SET returned_at = NULL, returned_note = NULL WHERE id = ?`).run(id);
    const row = getDb().prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    return rowToRental(row);
  });

  ipcMain.handle('rentals:delete', (event, id) => {
    const db = getDb();
    const rentalRow = db.prepare('SELECT * FROM rentals WHERE id = ?').get(id);
    if (rentalRow) {
      const carRow = db.prepare('SELECT * FROM cars WHERE id = ?').get(rentalRow.car_id);
      archiveDeletedRental(rentalRow, carRow || null);
    }
    db.prepare('DELETE FROM rentals WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle('rentals:updateRenterPhoto', (event, renterName, photo) => {
    const db = getDb();
    const target = (renterName || '').toLocaleLowerCase('tr');
    const rows = db.prepare('SELECT id, renter_name FROM rentals').all();
    const matchIds = rows.filter(r => (r.renter_name || '').toLocaleLowerCase('tr') === target).map(r => r.id);
    const upd = db.prepare('UPDATE rentals SET renter_photo = ? WHERE id = ?');
    const applyAll = db.transaction((ids) => {
      for (const id of ids) upd.run(photo || null, id);
    });
    applyAll(matchIds);
    return db.prepare('SELECT * FROM rentals ORDER BY id ASC').all().map(rowToRental);
  });
}

module.exports = { registerRentalsIpc, rowToRental };
