const PREFERENCE_KEYS = {
  defaultRole: "dota-helper:default-role",
  overlayStarted: "dota-helper:overlay-started",
  overlayBootMode: "dota-helper:overlay-boot-mode",
  overlayOnLaunch: "dota-helper:overlay-on-launch",
  ambientMotion: "dota-helper:ambient-motion",
};

function readPreference(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures. The app should remain usable without persistence.
  }
}

export { PREFERENCE_KEYS, readPreference, writePreference };
