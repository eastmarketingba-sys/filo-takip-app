const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function settingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

const DEFAULTS = { displayName: '', profilePhoto: null, language: 'tr' };

function getSettings() {
  const file = settingsFilePath();
  if (!fs.existsSync(file)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function setSettings(patch) {
  const merged = { ...getSettings(), ...(patch || {}) };
  fs.writeFileSync(settingsFilePath(), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { getSettings, setSettings };
