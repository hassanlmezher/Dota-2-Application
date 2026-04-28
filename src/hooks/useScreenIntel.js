import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeCapturedFrame,
  createFrameRuntime,
  loadHeroTemplates,
} from "../utils/screenVision";

const CHANNEL_NAME = "dota-helper-screen-intel";
const STORAGE_STATE_KEY = "dota-helper:screen-intel-state";
const STORAGE_STATUS_KEY = "dota-helper:screen-intel-status";
const ANALYSIS_INTERVAL_MS = 500;

const fallbackOverlayState = {
  visible: false,
  mode: "launcher",
};

let templateRuntimePromise = null;

function getElectronApi() {
  return window.electronAPI || null;
}

function createEmptyMatchState() {
  return {
    rawPayload: null,
    receivedAt: null,
    packetCount: 0,
    matchId: null,
    phase: "idle",
    gameState: "",
    mapStateLabel: "No capture started",
    clockLabel: "--:--",
    myHeroName: "",
    myItemNames: [],
    localTeam: null,
    audienceMode: "idle",
    feedScope: "screen",
    enemyHeroes: [],
    enemyHeroNames: [],
    enemyHealthList: [],
    enemyHealthMap: {},
    enemyItemNames: [],
    hasAnyLiveContext: false,
  };
}

function createIdleCaptureState() {
  return {
    status: "idle",
    active: false,
    sourceLabel: "",
    error: "",
    frameCount: 0,
    lastAnalyzedAt: null,
    ownerId: null,
  };
}

function createInstanceId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `screen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJsonStorage(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

function sanitizeMatchState(matchState) {
  if (!matchState) {
    return createEmptyMatchState();
  }

  const { _analysisCache, ...safeState } = matchState;
  return safeState;
}

function getTemplateRuntime() {
  if (!templateRuntimePromise) {
    templateRuntimePromise = loadHeroTemplates().catch((error) => {
      templateRuntimePromise = null;
      throw error;
    });
  }

  return templateRuntimePromise;
}

function createBroadcastChannel() {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  return new BroadcastChannel(CHANNEL_NAME);
}

export function useScreenIntel() {
  const instanceId = useMemo(() => createInstanceId(), []);
  const [matchState, setMatchState] = useState(() =>
    readJsonStorage(STORAGE_STATE_KEY, createEmptyMatchState())
  );
  const [captureState, setCaptureState] = useState(() =>
    readJsonStorage(STORAGE_STATUS_KEY, createIdleCaptureState())
  );
  const [overlayState, setOverlayState] = useState(fallbackOverlayState);
  const [isCaptureOwner, setIsCaptureOwner] = useState(false);
  const [appInfo, setAppInfo] = useState({
    isPackaged: false,
    appName: "Dota Helper App",
    capturePermissionTarget: "Electron",
  });
  const channelRef = useRef(null);
  const captureRef = useRef({
    disposed: false,
    intervalId: null,
    runtime: null,
    stream: null,
    track: null,
    video: null,
    analysisState: null,
    frameCount: 0,
  });
  const captureStateRef = useRef(captureState);
  const matchStateRef = useRef(matchState);
  const ownerRef = useRef(false);

  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);

  function publishState(nextState) {
    const safeState = sanitizeMatchState(nextState);
    writeJsonStorage(STORAGE_STATE_KEY, safeState);
    setMatchState(safeState);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: "screen:state",
        sender: instanceId,
        payload: safeState,
      });
    }
  }

  function publishStatus(nextStatus) {
    writeJsonStorage(STORAGE_STATUS_KEY, nextStatus);
    setCaptureState(nextStatus);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: "screen:status",
        sender: instanceId,
        payload: nextStatus,
      });
    }
  }

  function updateStatus(patch) {
    const nextStatus = {
      ...captureStateRef.current,
      ...patch,
    };

    captureStateRef.current = nextStatus;
    publishStatus(nextStatus);
    return nextStatus;
  }

  function clearLoop() {
    if (captureRef.current.intervalId) {
      window.clearInterval(captureRef.current.intervalId);
      captureRef.current.intervalId = null;
    }
  }

  function releaseCaptureResources({ stopTracks = true } = {}) {
    clearLoop();

    if (stopTracks) {
      captureRef.current.track?.stop?.();
      captureRef.current.stream?.getTracks?.().forEach((track) => {
        if (track.readyState === "live") {
          track.stop();
        }
      });
    }

    if (captureRef.current.video) {
      captureRef.current.video.pause?.();
      captureRef.current.video.srcObject = null;
    }

    captureRef.current.runtime = null;
    captureRef.current.stream = null;
    captureRef.current.track = null;
    captureRef.current.video = null;
    captureRef.current.analysisState = null;
    captureRef.current.frameCount = 0;
  }

  function stopCaptureInternal({
    broadcast = true,
    clearState = true,
    stopTracks = true,
    status = "idle",
    error = "",
  } = {}) {
    ownerRef.current = false;
    setIsCaptureOwner(false);
    releaseCaptureResources({ stopTracks });

    const nextStatus = {
      ...createIdleCaptureState(),
      status,
      active: false,
      error,
    };

    captureStateRef.current = nextStatus;

    if (broadcast) {
      publishStatus(nextStatus);
    } else {
      setCaptureState(nextStatus);
    }

    if (clearState) {
      const emptyState = createEmptyMatchState();

      if (broadcast) {
        publishState(emptyState);
      } else {
        setMatchState(emptyState);
      }
    }
  }

  async function startCapture() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const message = "This runtime does not support screen capture.";
      updateStatus({
        status: "error",
        active: false,
        error: message,
      });
      return { ok: false, message };
    }

    if (ownerRef.current) {
      return { ok: true, message: "Capture already running." };
    }

    const electronApi = getElectronApi();
    const screenAccessStatus = await electronApi?.capture?.getScreenAccessStatus?.();

    const permissionTarget =
      appInfo?.capturePermissionTarget ||
      (appInfo?.isPackaged ? appInfo.appName : "Electron");
    const permissionLooksBlocked =
      screenAccessStatus === "denied" || screenAccessStatus === "restricted";

    channelRef.current?.postMessage({
      type: "screen:takeover",
      sender: instanceId,
    });

    updateStatus({
      status: "requesting",
      active: false,
      error: "",
      sourceLabel: "",
      ownerId: instanceId,
      frameCount: 0,
      lastAnalyzedAt: null,
    });

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          frameRate: {
            ideal: 8,
            max: 10,
          },
        },
      });
      const track = stream.getVideoTracks()[0];

      if (!track) {
        throw new Error("No video track was returned by screen capture.");
      }

      updateStatus({
        status: "loading-models",
        active: true,
        error: "",
        sourceLabel: track.label || "Display capture",
        ownerId: instanceId,
      });

      const templateRuntime = await getTemplateRuntime();
      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      await new Promise((resolve, reject) => {
        const handleLoaded = () => {
          video.removeEventListener("loadedmetadata", handleLoaded);
          resolve();
        };

        const handleError = () => {
          video.removeEventListener("error", handleError);
          reject(new Error("Failed to load the selected capture source."));
        };

        video.addEventListener("loadedmetadata", handleLoaded, { once: true });
        video.addEventListener("error", handleError, { once: true });
      });

      await video.play();

      ownerRef.current = true;
      setIsCaptureOwner(true);
      captureRef.current.runtime = createFrameRuntime();
      captureRef.current.stream = stream;
      captureRef.current.track = track;
      captureRef.current.video = video;
      captureRef.current.analysisState = null;
      captureRef.current.frameCount = 0;

      track.addEventListener("ended", () => {
        if (!captureRef.current.disposed && ownerRef.current) {
          stopCaptureInternal({
            broadcast: true,
            clearState: true,
            stopTracks: false,
          });
        }
      });

      const runAnalysis = () => {
        if (!ownerRef.current || captureRef.current.disposed) {
          return;
        }

        const nextAnalysisState = analyzeCapturedFrame(
          captureRef.current.runtime,
          templateRuntime,
          video,
          captureRef.current.analysisState
        );

        if (!nextAnalysisState) {
          return;
        }

        captureRef.current.analysisState = nextAnalysisState;
        captureRef.current.frameCount += 1;

        const safeState = sanitizeMatchState(nextAnalysisState);
        publishState(safeState);
        updateStatus({
          status: "active",
          active: true,
          error: "",
          sourceLabel: track.label || "Display capture",
          ownerId: instanceId,
          frameCount: captureRef.current.frameCount,
          lastAnalyzedAt: safeState.receivedAt,
        });
      };

      runAnalysis();
      captureRef.current.intervalId = window.setInterval(runAnalysis, ANALYSIS_INTERVAL_MS);

      return { ok: true };
    } catch (error) {
      const isPermissionError =
        error?.name === "NotAllowedError" ||
        /permission|notallowed|denied/i.test(error?.message || "");
      const message = isPermissionError
        ? `Screen capture was blocked. On macOS, allow Screen Recording for ${permissionTarget} and then relaunch the app.`
        : permissionLooksBlocked
          ? `macOS still reports Screen Recording as blocked for ${permissionTarget}. Try relaunching the app after enabling the permission.`
        : error?.message || "Failed to start screen capture.";

      stopCaptureInternal({
        broadcast: true,
        clearState: true,
        stopTracks: true,
        status: "error",
        error: message,
      });
      return {
        ok: false,
        message,
      };
    }
  }

  function stopCapture() {
    stopCaptureInternal({
      broadcast: true,
      clearState: true,
      stopTracks: true,
    });
  }

  useEffect(() => {
    let removeOverlayStateListener = () => {};
    const electronApi = getElectronApi();
    captureRef.current.disposed = false;

    channelRef.current = createBroadcastChannel();

    const handleIncomingMessage = (event) => {
      const message = event?.data;

      if (!message || message.sender === instanceId) {
        return;
      }

      if (message.type === "screen:state" && message.payload) {
        setMatchState(message.payload);
        matchStateRef.current = message.payload;
        writeJsonStorage(STORAGE_STATE_KEY, message.payload);
      }

      if (message.type === "screen:status" && message.payload) {
        setCaptureState(message.payload);
        captureStateRef.current = message.payload;
        setIsCaptureOwner(Boolean(message.payload.ownerId === instanceId && message.payload.active));
        writeJsonStorage(STORAGE_STATUS_KEY, message.payload);
      }

      if (message.type === "screen:request-latest" && ownerRef.current) {
        publishState(matchStateRef.current);
        publishStatus(captureStateRef.current);
      }

      if (message.type === "screen:takeover" && ownerRef.current) {
        stopCaptureInternal({
          broadcast: false,
          clearState: false,
          stopTracks: true,
        });
      }
    };

    channelRef.current?.addEventListener("message", handleIncomingMessage);
    channelRef.current?.postMessage({
      type: "screen:request-latest",
      sender: instanceId,
    });

    if (!window.location.hash.includes("/overlay")) {
      getTemplateRuntime().catch(() => {
        // Template warm-up is best effort. The actual error is surfaced on startCapture.
      });
    }

    if (electronApi?.window?.getOverlayState) {
      electronApi.window.getOverlayState().then((nextOverlayState) => {
        setOverlayState(nextOverlayState || fallbackOverlayState);
      });

      removeOverlayStateListener =
        electronApi.window.onOverlayState?.((payload) => {
          setOverlayState(payload || fallbackOverlayState);
        }) || (() => {});
    }

    electronApi?.app?.getInfo?.().then((nextAppInfo) => {
      if (nextAppInfo) {
        setAppInfo((currentValue) => ({
          ...currentValue,
          ...nextAppInfo,
        }));
      }
    });

    return () => {
      const wasOwner = ownerRef.current;
      captureRef.current.disposed = true;
      channelRef.current?.removeEventListener("message", handleIncomingMessage);
      removeOverlayStateListener();

      if (wasOwner) {
        ownerRef.current = false;
        setIsCaptureOwner(false);
        releaseCaptureResources({ stopTracks: true });
        const idleStatus = createIdleCaptureState();
        const emptyState = createEmptyMatchState();
        writeJsonStorage(STORAGE_STATUS_KEY, idleStatus);
        writeJsonStorage(STORAGE_STATE_KEY, emptyState);
        channelRef.current?.postMessage({
          type: "screen:status",
          sender: instanceId,
          payload: idleStatus,
        });
        channelRef.current?.postMessage({
          type: "screen:state",
          sender: instanceId,
          payload: emptyState,
        });
      } else {
        releaseCaptureResources({ stopTracks: true });
      }

      channelRef.current?.close?.();
      channelRef.current = null;
    };
  }, [instanceId]);

  async function toggleOverlay() {
    const electronApi = getElectronApi();
    return electronApi?.toggleOverlay?.() || electronApi?.window?.toggleOverlay?.();
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
    captureState,
    focusMainWindow,
    hideOverlay,
    appInfo,
    isCaptureOwner,
    isElectronRuntime: Boolean(window.electronAPI?.isElectron),
    matchState,
    moveOverlay,
    overlayState,
    setOverlayMode,
    showOverlay,
    startCapture,
    stopCapture,
    relaunchApp: () => getElectronApi()?.app?.relaunch?.(),
    openScreenRecordingSettings: () =>
      getElectronApi()?.capture?.openScreenRecordingSettings?.(),
    toggleOverlay,
  };
}
