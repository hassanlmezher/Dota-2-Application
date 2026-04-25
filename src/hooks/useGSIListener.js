import { useEffect, useState } from "react";
import { createEmptyGsiState, reduceGsiState } from "../utils/gsiPayload";

const fallbackStatus = {
  running: false,
  host: "127.0.0.1",
  port: Number(import.meta.env.VITE_GSI_PORT || 3001),
  endpoint: `http://127.0.0.1:${Number(import.meta.env.VITE_GSI_PORT || 3001)}/gsi`,
  lastReceivedAt: null,
  packetCount: 0,
};

const fallbackOverlayState = {
  visible: false,
  mode: "launcher",
};

function getElectronApi() {
  return window.electronAPI || null;
}

export function useGSIListener({ autoStart = true } = {}) {
  const [matchState, setMatchState] = useState(createEmptyGsiState());
  const [serverStatus, setServerStatus] = useState(fallbackStatus);
  const [overlayState, setOverlayState] = useState(fallbackOverlayState);

  useEffect(() => {
    const electronAPI = getElectronApi();

    if (!electronAPI) {
      return undefined;
    }

    let removeStateListener = () => {};
    let removeStatusListener = () => {};
    let removeOverlayStateListener = () => {};
    let isMounted = true;

    function applyGsiUpdate(payload) {
      setMatchState((currentState) => reduceGsiState(currentState, payload || {}));
      setServerStatus((currentStatus) => ({
        ...currentStatus,
        packetCount:
          payload?.packetCount ?? currentStatus.packetCount ?? fallbackStatus.packetCount,
        lastReceivedAt:
          payload?.receivedAt ?? currentStatus.lastReceivedAt ?? fallbackStatus.lastReceivedAt,
      }));
    }

    async function initialize() {
      const startPromise =
        autoStart && electronAPI.gsi?.start
          ? electronAPI.gsi.start()
          : Promise.resolve(fallbackStatus);
      const latestStatePromise =
        electronAPI.getLastGSI?.() ||
        electronAPI.gsi?.getState?.() ||
        Promise.resolve(null);
      const latestStatusPromise =
        electronAPI.gsi?.getStatus?.() || Promise.resolve(fallbackStatus);
      const overlayStatePromise =
        electronAPI.window?.getOverlayState?.() || Promise.resolve(fallbackOverlayState);

      const [nextStatus, latestState, latestStatus, nextOverlayState] = await Promise.all([
        startPromise,
        latestStatePromise,
        latestStatusPromise,
        overlayStatePromise,
      ]);

      if (!isMounted) {
        return;
      }

      setServerStatus(latestStatus || nextStatus || fallbackStatus);
      setOverlayState(nextOverlayState || fallbackOverlayState);
      setMatchState(
        latestState
          ? reduceGsiState(createEmptyGsiState(), latestState)
          : createEmptyGsiState()
      );

      removeStateListener =
        electronAPI.onGSIUpdate?.(applyGsiUpdate) ||
        electronAPI.gsi?.onState?.(applyGsiUpdate) ||
        (() => {});
      removeStatusListener =
        electronAPI.gsi?.onStatus?.((payload) => {
          setServerStatus(payload || fallbackStatus);
        }) || (() => {});
      removeOverlayStateListener =
        electronAPI.window?.onOverlayState?.((payload) => {
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
    const electronAPI = getElectronApi();
    return electronAPI?.toggleOverlay?.() || electronAPI?.window?.toggleOverlay?.();
  }

  async function showOverlay(mode = "launcher") {
    return getElectronApi()?.window?.showOverlay?.(mode);
  }

  async function hideOverlay() {
    return getElectronApi()?.window?.hideOverlay?.();
  }

  async function setOverlayMode(mode) {
    return getElectronApi()?.window?.setOverlayMode?.(mode);
  }

  async function moveOverlay(x, y) {
    return getElectronApi()?.window?.moveOverlay?.({ x, y });
  }

  async function focusMainWindow() {
    return getElectronApi()?.window?.focusMain?.();
  }

  return {
    matchState,
    serverStatus,
    overlayState,
    myHeroName: matchState.myHeroName,
    enemyHeroNames: matchState.enemyHeroNames,
    enemyHealthMap: matchState.enemyHealthMap,
    enemyItemNames: matchState.enemyItemNames,
    focusMainWindow,
    hideOverlay,
    moveOverlay,
    setOverlayMode,
    showOverlay,
    toggleOverlay,
  };
}
