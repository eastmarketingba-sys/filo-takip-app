const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function sanitizeForFilename(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || 'kayit';
}

function archiveRoot() {
  return path.join(app.getPath('documents'), 'Filo Takip', 'Silinenler');
}

function timestampTag() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function writeArchiveEntry(subfolder, label, data) {
  try {
    const folder = path.join(archiveRoot(), subfolder);
    fs.mkdirSync(folder, { recursive: true });
    const filePath = path.join(folder, `${sanitizeForFilename(label)}-${timestampTag()}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ deletedAt: new Date().toISOString(), ...data }, null, 2));
  } catch (e) {
    // silinenler arşivi ikincil bir kayıt; yazılamazsa asıl silme işlemini engellememeli
  }
}

function archiveDeletedCar(carRow, rentalRows) {
  writeArchiveEntry('Araclar', carRow.name, { car: carRow, rentals: rentalRows });
}

function archiveDeletedRental(rentalRow, carRow) {
  writeArchiveEntry('Kiralamalar', rentalRow.renter_name, { rental: rentalRow, car: carRow || null });
}

const ARCHIVE_GROUPS = ['Araclar', 'Kiralamalar'];

function listArchived() {
  const items = [];
  for (const group of ARCHIVE_GROUPS) {
    const folder = path.join(archiveRoot(), group);
    if (!fs.existsSync(folder)) continue;
    for (const file of fs.readdirSync(folder)) {
      if (!file.endsWith('.json')) continue;
      const id = `${group}/${file}`;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
        items.push({
          id,
          type: group === 'Araclar' ? 'car' : 'rental',
          deletedAt: data.deletedAt || null,
          label: group === 'Araclar' ? (data.car && data.car.name) : (data.rental && data.rental.renter_name)
        });
      } catch (e) {
        // bozuk arşiv dosyası, listede atla
      }
    }
  }
  items.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  return items;
}

function resolveArchivePath(id) {
  const parts = String(id || '').split('/');
  if (parts.length !== 2 || !ARCHIVE_GROUPS.includes(parts[0]) || !parts[1].endsWith('.json') || parts[1].includes('..')) {
    return null;
  }
  return path.join(archiveRoot(), parts[0], parts[1]);
}

function readArchiveEntry(id) {
  const filePath = resolveArchivePath(id);
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function removeArchiveEntry(id) {
  const filePath = resolveArchivePath(id);
  if (!filePath) return;
  try { fs.unlinkSync(filePath); } catch (e) {}
}

module.exports = { archiveDeletedCar, archiveDeletedRental, archiveRoot, listArchived, readArchiveEntry, removeArchiveEntry };
