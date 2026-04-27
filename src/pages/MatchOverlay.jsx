import { useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import IntelBoard from "../components/IntelBoard";
import { PREFERENCE_KEYS, readPreference, writePreference } from "../utils/preferences";

export default function MatchOverlay() {
  const intel = useOutletContext();
  const [role, setRole] = useState(readPreference(PREFERENCE_KEYS.defaultRole, "carry"));
  const dragStateRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const overlayMode = intel?.overlayState?.mode || "launcher";
  const captureLabel =
    intel?.captureState?.status === "active"
      ? "Live Capture"
      : intel?.captureState?.status === "requesting"
        ? "Choosing Source"
        : "Capture Idle";

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    writePreference(PREFERENCE_KEYS.defaultRole, nextRole);
  }

  function resetLauncherDragState() {
    dragStateRef.current = {
      active: false,
      moved: false,
      pointerId: null,
      offsetX: 0,
      offsetY: 0,
    };
  }

  function handleLauncherPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      offsetX: event.clientX,
      offsetY: event.clientY,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleLauncherPointerMove(event) {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextX = event.screenX - dragState.offsetX;
    const nextY = event.screenY - dragState.offsetY;

    if (!dragState.moved) {
      const deltaX = Math.abs(event.movementX || 0);
      const deltaY = Math.abs(event.movementY || 0);

      if (deltaX > 0 || deltaY > 0) {
        dragState.moved = true;
      }
    }

    intel?.moveOverlay?.(nextX, nextY);
  }

  function handleLauncherPointerUp(event) {
    const dragState = dragStateRef.current;

    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const shouldOpenPanel = dragState.active && !dragState.moved;
    resetLauncherDragState();

    if (shouldOpenPanel) {
      intel?.setOverlayMode?.("panel");
    }
  }

  function handleLauncherPointerCancel(event) {
    const dragState = dragStateRef.current;

    if (dragState.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      resetLauncherDragState();
    }
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
            aria-label="Open overlay"
            onPointerDown={handleLauncherPointerDown}
            onPointerMove={handleLauncherPointerMove}
            onPointerUp={handleLauncherPointerUp}
            onPointerCancel={handleLauncherPointerCancel}
          >
            <span className="overlay-launcher__crest">DH</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="overlay-page overlay-page--panel">
      <div className="overlay-panel-shell overlay-panel-shell--clean">
        <header className="overlay-panel-header drag-region">
          <div>
            <span className="surface-nav__eyebrow">Dota Helper</span>
            <strong>Compact Overlay</strong>
            <small>{captureLabel}</small>
          </div>

          <div className="overlay-panel-header__actions no-drag">
            {!intel?.captureState?.active ? (
              <button
                type="button"
                className="overlay-header-button"
                onClick={() => intel?.startCapture?.()}
              >
                Start
              </button>
            ) : null}
            <button
              type="button"
              className="overlay-header-button"
              onClick={() => intel?.focusMainWindow?.()}
            >
              Full View
            </button>
            <button
              type="button"
              className="overlay-header-button"
              onClick={() => intel?.setOverlayMode?.("launcher")}
            >
              Collapse
            </button>
            <button
              type="button"
              className="overlay-header-button overlay-header-button--danger"
              onClick={() => intel?.hideOverlay?.()}
            >
              ×
            </button>
          </div>
        </header>

        <IntelBoard
          captureState={intel?.captureState}
          matchState={intel?.matchState}
          role={role}
          onRoleChange={handleRoleChange}
          variant="compact"
        />
      </div>
    </section>
  );
}
