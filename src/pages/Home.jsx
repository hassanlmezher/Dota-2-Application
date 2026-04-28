import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import IntelBoard from "../components/IntelBoard";
import { ROLE_LOOKUP } from "../constants/roles";
import { PREFERENCE_KEYS, readPreference, writePreference } from "../utils/preferences";

function StatusRow({ captureState, overlayState, role }) {
  return (
    <div className="capture-status-grid">
      <div className="capture-status-card">
        <span>Status</span>
        <strong>{captureState?.active ? "Capture active" : captureState?.status || "idle"}</strong>
      </div>
      <div className="capture-status-card">
        <span>Source</span>
        <strong>{captureState?.sourceLabel || "No source selected"}</strong>
      </div>
      <div className="capture-status-card">
        <span>Overlay</span>
        <strong>{overlayState?.visible ? overlayState.mode : "hidden"}</strong>
      </div>
      <div className="capture-status-card">
        <span>Role</span>
        <strong>{ROLE_LOOKUP[role]}</strong>
      </div>
    </div>
  );
}

export default function Home() {
  const intel = useOutletContext();
  const ambientMotion = readPreference(PREFERENCE_KEYS.ambientMotion, true);
  const [role, setRole] = useState(readPreference(PREFERENCE_KEYS.defaultRole, "carry"));
  const captureActive = Boolean(intel?.captureState?.active);

  async function handleStartCapture() {
    const result = await intel?.startCapture?.();

    if (result?.ok && !intel?.overlayState?.visible) {
      const bootMode = readPreference(PREFERENCE_KEYS.overlayBootMode, "launcher");
      await intel?.showOverlay?.(bootMode);
    }
  }

  const permissionTarget =
    intel?.appInfo?.capturePermissionTarget ||
    (intel?.appInfo?.isPackaged ? intel?.appInfo?.appName : "Electron");
  const showScreenRecordingHelp =
    /screen capture|screen recording/i.test(intel?.captureState?.error || "");

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    writePreference(PREFERENCE_KEYS.defaultRole, nextRole);
  }

  return (
    <section
      className={`surface-page surface-page--clean ${
        ambientMotion ? "surface-page--ambient" : ""
      }`}
    >
      <header className="surface-nav surface-nav--clean">
        <div className="surface-nav__brand">
          <span className="surface-nav__eyebrow">Dota Helper</span>
          <strong>Screen Overlay</strong>
        </div>

        <div className="surface-nav__actions">
          <span
            className={`status-pill ${
              captureActive ? "status-pill--online" : "status-pill--offline"
            }`}
          >
            {captureActive ? "Live Capture" : "Not Capturing"}
          </span>
          <Link to="/settings" className="surface-icon-button">
            Settings
          </Link>
        </div>
      </header>

      <section className="landing-hero landing-hero--clean">
        <div className="landing-hero__content landing-hero__content--clean">
          <span className="landing-badge">No GSI setup required</span>
          <h1>Dota capture overlay</h1>
          <p>
            The app now auto-locks onto Dota when you press start. It reads the screen
            to infer draft heroes, live enemy health, and item responses for bots, real
            matches, and spectating.
          </p>

          <div className="landing-hero__actions">
            {captureActive ? (
              <button
                type="button"
                className="dota-cta dota-cta--quiet"
                onClick={() => intel?.stopCapture?.()}
              >
                <span>Stop Capture</span>
              </button>
            ) : (
              <button type="button" className="dota-cta" onClick={handleStartCapture}>
                <span className="dota-cta__icon">▶</span>
                <span>Start Scan</span>
              </button>
            )}

            <button
              type="button"
              className="surface-tertiary-button"
              onClick={() =>
                intel?.overlayState?.visible
                  ? intel?.hideOverlay?.()
                  : intel?.showOverlay?.(readPreference(PREFERENCE_KEYS.overlayBootMode, "launcher"))
              }
            >
              {intel?.overlayState?.visible ? "Hide Overlay" : "Show Overlay"}
            </button>
          </div>

          {intel?.captureState?.error ? (
            <div className="capture-inline-error-card">
              <p className="capture-inline-error">{intel.captureState.error}</p>
              {showScreenRecordingHelp ? (
                <div className="capture-inline-error-actions">
                  <button
                    type="button"
                    className="surface-tertiary-button"
                    onClick={() => intel?.openScreenRecordingSettings?.()}
                  >
                    Open Screen Recording Settings
                  </button>
                  <button
                    type="button"
                    className="surface-tertiary-button"
                    onClick={() => intel?.relaunchApp?.()}
                  >
                    Relaunch App
                  </button>
                  <span className="capture-inline-hint">
                    Enable access for <strong>{permissionTarget}</strong>, then relaunch
                    the app from here and press <strong>Start Scan</strong> again.
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <StatusRow
        captureState={intel?.captureState}
        overlayState={intel?.overlayState}
        role={role}
      />

      <section className="dashboard-surface dashboard-surface--clean">
        <div className="dashboard-surface__header">
          <div>
            <p className="intel-kicker">Main View</p>
            <h2>Match board</h2>
          </div>
          <button
            type="button"
            className="surface-tertiary-button"
            onClick={() => intel?.focusMainWindow?.()}
          >
            Focus Window
          </button>
        </div>

        <IntelBoard
          captureState={intel?.captureState}
          matchState={intel?.matchState}
          role={role}
          onRoleChange={handleRoleChange}
          variant="full"
        />
      </section>
    </section>
  );
}
