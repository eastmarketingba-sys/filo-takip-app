const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDb } = require('./db');

function backupFolder() {
  return path.join(app.getPath('documents'), 'Filo Takip', 'Yedekler');
}

function dayTag(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAILY_BACKUP_RE = /^filo-takip-yedek-(\d{4})-(\d{2})-(\d{2})\.db$/;

// Günlük yedekleri 30 gün saklar; her ayın ilk yedeğini kalıcı olarak tutar
// (böylece disk şişmeden hem yakın geçmiş hem de uzun vadeli aylık geçmiş korunur).
function pruneOldBackups(folder) {
  let files;
  try { files = fs.readdirSync(folder); } catch (e) { return; }
  const parsed = files
    .map(f => { const m = f.match(DAILY_BACKUP_RE); return m ? { file: f, tag: `${m[1]}-${m[2]}-${m[3]}`, monthTag: `${m[1]}-${m[2]}` } : null; })
    .filter(Boolean)
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const keepAsMonthly = new Set();
  const seenMonths = new Set();
  for (const p of parsed) {
    if (!seenMonths.has(p.monthTag)) { seenMonths.add(p.monthTag); keepAsMonthly.add(p.file); }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffTag = dayTag(cutoff);

  for (const p of parsed) {
    if (p.tag < cutoffTag && !keepAsMonthly.has(p.file)) {
      try { fs.unlinkSync(path.join(folder, p.file)); } catch (e) {}
    }
  }
}

async function runDailyBackupIfNeeded() {
  const folder = backupFolder();
  fs.mkdirSync(folder, { recursive: true });
  const filePath = path.join(folder, `filo-takip-yedek-${dayTag(new Date())}.db`);
  if (fs.existsSync(filePath)) { pruneOldBackups(folder); return { ran: false }; }
  try {
    await getDb().backup(filePath);
    pruneOldBackups(folder);
    return { ran: true, filePath };
  } catch (e) {
    // otomatik yedekleme kullanıcıyı kesintiye uğratmamalı, sessiz geç
    return { ran: false, error: e.message };
  }
}

function getLastBackupInfo() {
  const folder = backupFolder();
  if (!fs.existsSync(folder)) return null;
  const files = fs.readdirSync(folder).filter(f => f.endsWith('.db'));
  if (!files.length) return null;
  let latest = null;
  for (const f of files) {
    const stat = fs.statSync(path.join(folder, f));
    if (!latest || stat.mtimeMs > latest.mtimeMs) latest = { fileName: f, mtimeMs: stat.mtimeMs };
  }
  return { fileName: latest.fileName, date: new Date(latest.mtimeMs).toISOString() };
}

module.exports = { runDailyBackupIfNeeded, backupFolder, getLastBackupInfo };
