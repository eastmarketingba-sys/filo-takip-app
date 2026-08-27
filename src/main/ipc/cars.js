const { ipcMain } = require('electron');
const { getDb } = require('../db');
const { archiveDeletedCar } = require('../deletedArchive');

function rowToCar(row) {
  return {
    id: String(row.id),
    name: row.name,
    plate: row.plate,
    photo: row.photo,
    avgPrice: row.avg_price,
    note: row.note,
    favorite: !!row.favorite
  };
}

function registerCarsIpc() {
  ipcMain.handle('cars:list', () => {
    const rows = getDb().prepare('SELECT * FROM cars ORDER BY id ASC').all();
    return rows.map(rowToCar);
  });

  ipcMain.handle('cars:add', (event, data) => {
    const { name, plate, photo, avgPrice, note } = data || {};
    const info = getDb()
      .prepare('INSERT INTO cars (name, plate, photo, avg_price, note) VALUES (?, ?, ?, ?, ?)')
      .run(name, plate || null, photo || null, avgPrice != null ? avgPrice : null, note || null);
    const row = getDb().prepare('SELECT * FROM cars WHERE id = ?').get(info.lastInsertRowid);
    return rowToCar(row);
  });

  ipcMain.handle('cars:update', (event, id, patch) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM cars WHERE id = ?').get(id);
    if (!existing) return null;
    patch = patch || {};
    const name = patch.name !== undefined ? patch.name : existing.name;
    const plate = patch.plate !== undefined ? patch.plate : existing.plate;
    const photo = patch.photo !== undefined ? patch.photo : existing.photo;
    const avgPrice = patch.avgPrice !== undefined ? patch.avgPrice : existing.avg_price;
    const note = patch.note !== undefined ? patch.note : existing.note;
    const favorite = patch.favorite !== undefined ? (patch.favorite ? 1 : 0) : existing.favorite;
    db.prepare(
      `UPDATE cars SET name = ?, plate = ?, photo = ?, avg_price = ?, note = ?, favorite = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(name, plate, photo, avgPrice, note, favorite, id);
    const row = db.prepare('SELECT * FROM cars WHERE id = ?').get(id);
    return rowToCar(row);
  });

  ipcMain.handle('cars:delete', (event, id) => {
    const db = getDb();
    const carRow = db.prepare('SELECT * FROM cars WHERE id = ?').get(id);
    if (carRow) {
      const rentalRows = db.prepare('SELECT * FROM rentals WHERE car_id = ?').all(id);
      archiveDeletedCar(carRow, rentalRows);
    }
    db.prepare('DELETE FROM cars WHERE id = ?').run(id);
    return true;
  });
}

module.exports = { registerCarsIpc, rowToCar };
