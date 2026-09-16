// Oturum açmış çalışanın profilini (org_id/role/id/displayName) main process
// içinde bellekte tutar. cars.js/rentals.js gibi IPC handler'ları, her Supabase
// yazma işleminde org_id/created_by doldurmak için buradan okur.

let currentProfile = null;

function setCurrentProfile(profile) {
  currentProfile = profile;
}

function getCurrentProfile() {
  return currentProfile;
}

function clearCurrentProfile() {
  currentProfile = null;
}

module.exports = { setCurrentProfile, getCurrentProfile, clearCurrentProfile };
