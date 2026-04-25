import { useEffect, useState } from "react";

const fallbackStatus = {
  running: false,
  host: "127.0.0.1",
  port: Number(import.meta.env.VITE_GSI_PORT || 3001),
  endpoint: `http://127.0.0.1:${Number(import.meta.env.VITE_GSI_PORT || 3001)}/gsi`,
};

export function useGSIListener({ autoStart = true } = {}) {
  const [matchState, setMatchState] = useState(null);
  const [serverStatus, setServerStatus] = useState(fallbackStatus);

  useEffect(() => {
    if (!window.electronAPI?.gsi) {
      return undefined;
    }

    let removeStateListener = () => {};
    let removeStatusListener = () => {};
    let isMounted = true;

    async function initialize() {
      if (autoStart) {
        const nextStatus = await window.electronAPI.gsi.start();
        if (isMounted) {
          setServerStatus(nextStatus);
        }
      }

      const [latestState, latestStatus] = await Promise.all([
        window.electronAPI.gsi.getState(),
        window.electronAPI.gsi.getStatus(),
      ]);

      if (isMounted) {
        setMatchState(latestState);
        setServerStatus(latestStatus);
      }

      removeStateListener = window.electronAPI.gsi.onState((payload) => {
        setMatchState(payload);
      });
      removeStatusListener = window.electronAPI.gsi.onStatus((payload) => {
        setServerStatus(payload);
      });
    }

    initialize();

    return () => {
      isMounted = false;
      removeStateListener();
      removeStatusListener();
    };
  }, [autoStart]);

  async function toggleOverlay() {
    return window.electronAPI?.window?.toggleOverlay?.();
  }

  return {
    matchState,
    serverStatus,
    toggleOverlay,
  };
}
