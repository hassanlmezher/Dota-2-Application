import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import IntelBoard from "../components/IntelBoard";
import { PREFERENCE_KEYS, readPreference, writePreference } from "../utils/preferences";

export default function MatchOverlay() {
  const gsi = useOutletContext();
  const [role, setRole] = useState(readPreference(PREFERENCE_KEYS.defaultRole, "carry"));
  const overlayMode = gsi?.overlayState?.mode || "launcher";

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    writePreference(PREFERENCE_KEYS.defaultRole, nextRole);
  }

  if (!window.electronAPI?.isElectron) {
    return (
      <section className="overlay-page overlay-page--browser">
        <div className="overlay-panel-shell">
          <p>Overlay mode is available only inside Electron.</p>
        </div>
      </section>
    );
  }

  if (overlayMode === "launcher") {
    return (
      <section className="overlay-page overlay-page--launcher">
        <div className="overlay-launcher drag-region">
          <button
            type="button"
            className="overlay-launcher__button no-drag"
            onClick={() => gsi.setOverlayMode("panel")}
            aria-label="Open overlay"
          >
            <span className="overlay-launcher__crest">DH</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="overlay-page overlay-page--panel">
      <div className="overlay-panel-shell">
        <header className="overlay-panel-header drag-region">
          <div>
            <span className="surface-nav__eyebrow">DOTA HELPER</span>
            <strong>Compact Overlay</strong>
          </div>

          <div className="overlay-panel-header__actions no-drag">
            <button
              type="button"
              className="overlay-header-button"
              onClick={() => gsi.focusMainWindow()}
            >
              Full View
            </button>
            <button
              type="button"
              className="overlay-header-button"
              onClick={() => gsi.setOverlayMode("launcher")}
            >
              Collapse
            </button>
            <button
              type="button"
              className="overlay-header-button overlay-header-button--danger"
              onClick={() => gsi.hideOverlay()}
            >
              ×
            </button>
          </div>
        </header>

        <IntelBoard
          matchState={gsi?.matchState}
          serverStatus={gsi?.serverStatus}
          role={role}
          onRoleChange={handleRoleChange}
          variant="compact"
        />
      </div>
    </section>
  );
}
