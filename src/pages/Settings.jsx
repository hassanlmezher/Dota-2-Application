import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ROLES, ROLE_LOOKUP } from "../constants/roles";
import { hasCredentials } from "../api/supabaseClient";
import { PREFERENCE_KEYS, readPreference, writePreference } from "../utils/preferences";
import { setupDotaGsi } from "../utils/setupDotaGsi";

export default function Settings() {
  const gsi = useOutletContext();
  const isElectronRuntime = Boolean(window.electronAPI?.isElectron);
  const [defaultRole, setDefaultRole] = useState(
    readPreference(PREFERENCE_KEYS.defaultRole, "carry")
  );
  const [overlayBootMode, setOverlayBootMode] = useState(
    readPreference(PREFERENCE_KEYS.overlayBootMode, "launcher")
  );
  const [overlayOnLaunch, setOverlayOnLaunch] = useState(
    readPreference(PREFERENCE_KEYS.overlayOnLaunch, true)
  );
  const [ambientMotion, setAmbientMotion] = useState(
    readPreference(PREFERENCE_KEYS.ambientMotion, true)
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [gsiSetupMessage, setGsiSetupMessage] = useState("");
  const [gsiSetupVariant, setGsiSetupVariant] = useState("idle");

  const endpointLabel = useMemo(
    () => gsi?.serverStatus?.endpoint || "http://127.0.0.1:3001/gsi",
    [gsi?.serverStatus?.endpoint]
  );
  const gsiConfigSnippet = useMemo(
    () => `"DotaHelper"
{
  "uri"           "${endpointLabel}"
  "timeout"       "5.0"
  "buffer"        "0.1"
  "throttle"      "0.1"
  "heartbeat"     "30.0"
  "data"
  {
    "provider"    "1"
    "map"         "1"
    "draft"       "1"
    "allplayers"  "1"
    "allheroes"   "1"
    "hero"        "1"
    "player"      "1"
    "items"       "1"
    "abilities"   "1"
  }
}`,
    [endpointLabel]
  );

  function handleSave() {
    writePreference(PREFERENCE_KEYS.defaultRole, defaultRole);
    writePreference(PREFERENCE_KEYS.overlayBootMode, overlayBootMode);
    writePreference(PREFERENCE_KEYS.overlayOnLaunch, overlayOnLaunch);
    writePreference(PREFERENCE_KEYS.ambientMotion, ambientMotion);
    setSavedMessage("Configuration saved.");
    window.setTimeout(() => setSavedMessage(""), 1800);
  }

  async function handleAutoSetupGsi() {
    setGsiSetupVariant("pending");
    setGsiSetupMessage("Creating the Dota GSI config file...");

    try {
      const result = await setupDotaGsi(gsiConfigSnippet);

      if (result?.ok) {
        setGsiSetupVariant("success");
        setGsiSetupMessage(
          result.filePath
            ? `Created ${result.filePath}`
            : result.message || "Dota GSI config created."
        );
        return;
      }

      if (result?.canceled) {
        setGsiSetupVariant("idle");
        setGsiSetupMessage(result.message || "Auto setup canceled.");
        return;
      }

      setGsiSetupVariant("error");
      setGsiSetupMessage(result?.message || "Failed to create the Dota GSI config file.");
    } catch (error) {
      setGsiSetupVariant("error");
      setGsiSetupMessage(error?.message || "Failed to create the Dota GSI config file.");
    }
  }

  return (
    <section className="settings-page">
      <header className="surface-nav">
        <div className="surface-nav__brand">
          <Link to="/" className="surface-back-link">
            ← Back
          </Link>
          <strong>Settings</strong>
        </div>
        <div className="surface-nav__actions">
          <span className="status-pill status-pill--online">
            {gsi?.serverStatus?.running ? "GSI Listening" : "Awaiting GSI"}
          </span>
        </div>
      </header>

      <div className="settings-shell">
        <aside className="settings-sidebar">
          <span className="settings-sidebar__kicker">General</span>
          <h1>Settings</h1>
          <p>
            Configure the overlay launch mode, save your preferred role, and confirm
            the Dota 2 GSI target.
          </p>

          <div className="settings-premium-card">
            <strong>Runtime</strong>
            <span>{isElectronRuntime ? "Electron desktop" : "Browser preview"}</span>
          </div>
        </aside>

        <div className="settings-content">
          <section className="settings-panel">
            <div className="intel-section-header">
              <h3>Overlay Settings</h3>
              <span>{overlayBootMode === "launcher" ? "Launcher first" : "Panel first"}</span>
            </div>

            <div className="settings-toggle-row">
              <div>
                <strong>Open as launcher first</strong>
                <p>The first overlay state is the small movable button on the right edge.</p>
              </div>
              <button
                type="button"
                className={`settings-switch ${
                  overlayBootMode === "launcher" ? "settings-switch--active" : ""
                }`}
                onClick={() =>
                  setOverlayBootMode((currentValue) =>
                    currentValue === "launcher" ? "panel" : "launcher"
                  )
                }
              >
                <span />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div>
                <strong>Remember overlay enabled state</strong>
                <p>Preserves whether the start button has already been pressed in this app.</p>
              </div>
              <button
                type="button"
                className={`settings-switch ${
                  overlayOnLaunch ? "settings-switch--active" : ""
                }`}
                onClick={() => setOverlayOnLaunch((currentValue) => !currentValue)}
              >
                <span />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div>
                <strong>Ambient motion</strong>
                <p>Enables the animated background glow across the main dashboard.</p>
              </div>
              <button
                type="button"
                className={`settings-switch ${
                  ambientMotion ? "settings-switch--active" : ""
                }`}
                onClick={() => setAmbientMotion((currentValue) => !currentValue)}
              >
                <span />
              </button>
            </div>
          </section>

          <section className="settings-panel">
            <div className="intel-section-header">
              <h3>Default Draft Role</h3>
              <span>{ROLE_LOOKUP[defaultRole]}</span>
            </div>

            <div className="intel-role-grid">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  className={`intel-role-pill ${
                    defaultRole === role.value ? "intel-role-pill--active" : ""
                  }`}
                  onClick={() => setDefaultRole(role.value)}
                >
                  <span>{role.shortLabel}</span>
                  <strong>{role.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-panel">
            <div className="intel-section-header">
              <h3>GSI Endpoint</h3>
              <span>{hasCredentials ? "Supabase ready" : "Missing anon key"}</span>
            </div>

            <div className="settings-callout">
              <strong>{isElectronRuntime ? "One-click desktop setup" : "Browser preview limitations"}</strong>
              <p>
                {isElectronRuntime
                  ? "The desktop app scans Steam library folders and writes the GSI config automatically."
                  : "A normal browser cannot silently write into your Dota install, so preview mode may ask for a folder or download the `.cfg` file instead."}
              </p>
            </div>

            <div className="settings-action-row">
              <button
                type="button"
                className="surface-tertiary-button settings-gsi-button"
                onClick={handleAutoSetupGsi}
              >
                Auto Setup Dota GSI
              </button>
              <span
                className={`settings-inline-message ${
                  gsiSetupVariant === "success"
                    ? "settings-inline-message--success"
                    : gsiSetupVariant === "error"
                      ? "settings-inline-message--error"
                      : ""
                }`}
              >
                {gsiSetupMessage ||
                  (isElectronRuntime
                    ? "The desktop app now scans Steam libraries and should complete setup with one click."
                    : "Use the Electron desktop app for true one-click setup. Browser mode is sandboxed.")}
              </span>
            </div>

            <div className="settings-runtime-list">
              <div className="settings-runtime-row">
                <span>Endpoint</span>
                <strong>{endpointLabel}</strong>
              </div>
              <div className="settings-runtime-row">
                <span>Last packet</span>
                <strong>{gsi?.serverStatus?.lastReceivedAt || "None received yet"}</strong>
              </div>
              <div className="settings-runtime-row">
                <span>Packets seen</span>
                <strong>{gsi?.serverStatus?.packetCount || 0}</strong>
              </div>
              <div className="settings-runtime-row">
                <span>Overlay state</span>
                <strong>
                  {gsi?.overlayState?.visible
                    ? gsi.overlayState.mode.toUpperCase()
                    : "Hidden"}
                </strong>
              </div>
              <div className="settings-runtime-row">
                <span>Supabase client</span>
                <strong>{hasCredentials ? "Configured" : "Missing credentials"}</strong>
              </div>
            </div>

            <pre className="code-block">
              <code>{gsiConfigSnippet}</code>
            </pre>
          </section>

          <footer className="settings-footer">
            <span>{savedMessage || "Changes apply immediately after save."}</span>
            <button type="button" className="dota-cta dota-cta--small" onClick={handleSave}>
              <span>Save Configuration</span>
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}
