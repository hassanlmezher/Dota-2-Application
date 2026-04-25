import { useEffect, useState } from "react";

const fallbackStatus = {
  running: false,
  host: "127.0.0.1",
  port: Number(import.meta.env.VITE_GSI_PORT || 3001),
  endpoint: `http://127.0.0.1:${Number(import.meta.env.VITE_GSI_PORT || 3001)}/gsi`,
};

const fallbackOverlayState = {
  visible: false,
  mode: "launcher",
};

export function useGSIListener({ autoStart = true } = {}) {
  const [matchState, setMatchState] = useState(null);
  const [serverStatus, setServerStatus] = useState(fallbackStatus);
  const [overlayState, setOverlayState] = useState(fallbackOverlayState);

  useEffect(() => {
    if (!window.electronAPI?.gsi) {
      return undefined;
    }

    let removeStateListener = () => {};
    let removeStatusListener = () => {};
    let removeOverlayStateListener = () => {};
    let isMounted = true;

    async function initialize() {
      if (autoStart) {
        const nextStatus = await window.electronAPI.gsi.start();
        if (isMounted) {
          setServerStatus(nextStatus);
        }
      }

      const [latestState, latestStatus, nextOverlayState] = await Promise.all([
        window.electronAPI.gsi.getState(),
        window.electronAPI.gsi.getStatus(),
        window.electronAPI.window?.getOverlayState?.() || fallbackOverlayState,
      ]);

      if (isMounted) {
        setMatchState(latestState);
        setServerStatus(latestStatus);
        setOverlayState(nextOverlayState || fallbackOverlayState);
      }

      removeStateListener = window.electronAPI.gsi.onState((payload) => {
        setMatchState(payload);
      });
      removeStatusListener = window.electronAPI.gsi.onStatus((payload) => {
        setServerStatus(payload);
      });
      removeOverlayStateListener = window.electronAPI.window?.onOverlayState?.((payload) => {
        setOverlayState(payload || fallbackOverlayState);
      }) || (() => {});
    }

    initialize();

    return () => {
      isMounted = false;
      removeStateListener();
      removeStatusListener();
      removeOverlayStateListener();
    };
  }, [autoStart]);

  async function toggleOverlay() {
    return window.electronAPI?.window?.toggleOverlay?.();
  }

  async function showOverlay(mode = "launcher") {
    return window.electronAPI?.window?.showOverlay?.(mode);
  }

  async function hideOverlay() {
    return window.electronAPI?.window?.hideOverlay?.();
  }

  async function setOverlayMode(mode) {
    return window.electronAPI?.window?.setOverlayMode?.(mode);
  }

  async function focusMainWindow() {
    return window.electronAPI?.window?.focusMain?.();
  }

  return {
    matchState,
    serverStatus,
    overlayState,
    focusMainWindow,
    hideOverlay,
    setOverlayMode,
    showOverlay,
    toggleOverlay,
  };
}
