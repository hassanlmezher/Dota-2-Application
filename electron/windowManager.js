const { BrowserWindow, screen, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createOverlayWindow } = require("./overlayWindow.js");

const preloadPath = path.join(__dirname, "preload.js");
const distIndexPath = path.join(__dirname, "..", "dist", "index.html");

const OVERLAY_MODES = {
  launcher: {
    width: 88,
    height: 88,
  },
  panel: {
    width: 456,
    height: 820,
  },
};

let mainWindow = null;
let panelWindow = null;
let overlayMode = "launcher";
let lastActiveDisplayId = null;
const launcherWindows = new Map();

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRendererBaseUrl() {
  return process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
}

function resolveRendererTarget(route = "/") {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;

  if (process.env.VITE_DEV_SERVER_URL) {
    return `${getRendererBaseUrl()}#${normalizedRoute}`;
  }

  const fileUrl = pathToFileURL(distIndexPath).toString();
  return `${fileUrl}#${normalizedRoute}`;
}

function isTransientLoadError(error) {
  const message = `${error?.message || ""}`.toLowerCase();

  return (
    message.includes("err_aborted") ||
    message.includes("err_connection_refused") ||
    message.includes("err_connection_reset") ||
    message.includes("err_internet_disconnected")
  );
}

async function loadWindowRoute(browserWindow, route, attempts = 8) {
  const targetUrl = resolveRendererTarget(route);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await browserWindow.loadURL(targetUrl);
      return;
    } catch (error) {
      if (!isTransientLoadError(error) || attempt === attempts - 1) {
        throw error;
      }

      await delay(350);
    }
  }
}

function attachWindowDefaults(browserWindow) {
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function normalizeOverlayMode(mode) {
  return mode in OVERLAY_MODES ? mode : "launcher";
}

function getOverlayModeSize(mode = overlayMode) {
  return OVERLAY_MODES[normalizeOverlayMode(mode)];
}

function getOverlayWindows() {
  const windows = [];

  for (const browserWindow of launcherWindows.values()) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      windows.push(browserWindow);
    }
  }

  if (panelWindow && !panelWindow.isDestroyed()) {
    windows.push(panelWindow);
  }

  return windows;
}

function getPrimaryOverlayWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow;
  }

  return getOverlayWindows()[0] || null;
}

function getOverlayVisibility() {
  return getOverlayWindows().some(
    (browserWindow) => browserWindow && !browserWindow.isDestroyed() && browserWindow.isVisible()
  );
}

function getOverlayState() {
  return {
    visible: getOverlayVisibility(),
    mode: overlayMode,
  };
}

function getDisplayForId(displayId) {
  const displays = screen.getAllDisplays();

  if (displayId !== null && displayId !== undefined) {
    const matchedDisplay = displays.find(
      (display) => String(display.id) === String(displayId)
    );

    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  return screen.getPrimaryDisplay();
}

function setLastActiveDisplay(displayId) {
  const display = getDisplayForId(displayId);
  lastActiveDisplayId = display.id;
  return display;
}

function resolveDisplayFromWindow(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return setLastActiveDisplay(lastActiveDisplayId);
  }

  const display = screen.getDisplayMatching(browserWindow.getBounds());
  lastActiveDisplayId = display.id;
  return display;
}

function resolveDisplayFromSender(sender) {
  if (!sender) {
    return setLastActiveDisplay(lastActiveDisplayId);
  }

  const browserWindow = BrowserWindow.fromWebContents(sender);

  if (!browserWindow || browserWindow.isDestroyed()) {
    return setLastActiveDisplay(lastActiveDisplayId);
  }

  return resolveDisplayFromWindow(browserWindow);
}

function calculateInitialOverlayBounds(mode = overlayMode, display = null) {
  const resolvedDisplay = display || setLastActiveDisplay(lastActiveDisplayId);
  const workArea = resolvedDisplay.workArea;
  const size = getOverlayModeSize(mode);

  return {
    width: size.width,
    height: size.height,
    x: workArea.x + workArea.width - size.width - 24,
    y: workArea.y + Math.round((workArea.height - size.height) / 2),
  };
}

function calculateClampedBounds(mode, display, currentBounds = null) {
  const workArea = display.workArea;
  const size = getOverlayModeSize(mode);
  const fallbackBounds = calculateInitialOverlayBounds(mode, display);

  if (!currentBounds) {
    return fallbackBounds;
  }

  const currentRight = currentBounds.x + currentBounds.width;
  const currentY = currentBounds.y;

  return {
    width: size.width,
    height: size.height,
    x: clamp(
      currentRight - size.width,
      workArea.x + 12,
      workArea.x + workArea.width - size.width - 12
    ),
    y: clamp(
      mode === "panel" ? currentY - 36 : currentY,
      workArea.y + 12,
      workArea.y + workArea.height - size.height - 12
    ),
  };
}

function applyOverlayWindowMode(browserWindow, mode, bounds) {
  browserWindow.setMinimumSize(bounds.width, bounds.height);
  browserWindow.setMaximumSize(bounds.width, bounds.height);
  browserWindow.setBounds(bounds, true);
  browserWindow.setResizable(false);
  browserWindow.setFocusable(true);
  browserWindow.setAlwaysOnTop(true, "screen-saver");
  browserWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  browserWindow.setFullScreenable(false);
}

function notifyOverlayState() {
  const state = getOverlayState();

  for (const browserWindow of [mainWindow, ...getOverlayWindows()]) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send("overlay:state", state);
    }
  }

  return state;
}

async function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "Dota Helper App",
    autoHideMenuBar: true,
    backgroundColor: "#09090d",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  attachWindowDefaults(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await loadWindowRoute(mainWindow, "/");
  notifyOverlayState();
  return mainWindow;
}

async function createLauncherWindow(display) {
  const browserWindow = createOverlayWindow({
    preloadPath,
    bounds: calculateInitialOverlayBounds("launcher", display),
  });

  browserWindow.__overlayKind = "launcher";
  browserWindow.__overlayDisplayId = display.id;

  attachWindowDefaults(browserWindow);

  browserWindow.on("close", () => {
    notifyOverlayState();
  });

  browserWindow.on("closed", () => {
    launcherWindows.delete(String(display.id));
    notifyOverlayState();
  });

  await loadWindowRoute(browserWindow, "/overlay");
  launcherWindows.set(String(display.id), browserWindow);
  applyOverlayWindowMode(
    browserWindow,
    "launcher",
    calculateInitialOverlayBounds("launcher", display)
  );
  browserWindow.hide();

  return browserWindow;
}

async function ensureLauncherWindows() {
  const displays = screen.getAllDisplays();
  const activeDisplayIds = new Set(displays.map((display) => String(display.id)));

  for (const [displayId, browserWindow] of launcherWindows.entries()) {
    if (!activeDisplayIds.has(displayId) && browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.destroy();
      launcherWindows.delete(displayId);
    }
  }

  for (const display of displays) {
    const key = String(display.id);
    const existingWindow = launcherWindows.get(key);

    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.__overlayDisplayId = display.id;
      applyOverlayWindowMode(
        existingWindow,
        "launcher",
        calculateClampedBounds("launcher", display, existingWindow.getBounds())
      );
      continue;
    }

    await createLauncherWindow(display);
  }

  return [...launcherWindows.values()].filter(Boolean);
}

async function ensurePanelWindow(options = {}) {
  const targetDisplay = options.sender
    ? resolveDisplayFromSender(options.sender)
    : setLastActiveDisplay(options.displayId ?? lastActiveDisplayId);

  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.__overlayDisplayId = targetDisplay.id;
    applyOverlayWindowMode(
      panelWindow,
      "panel",
      calculateClampedBounds("panel", targetDisplay, panelWindow.getBounds())
    );
    return panelWindow;
  }

  panelWindow = createOverlayWindow({
    preloadPath,
    bounds: calculateInitialOverlayBounds("panel", targetDisplay),
  });

  panelWindow.__overlayKind = "panel";
  panelWindow.__overlayDisplayId = targetDisplay.id;

  attachWindowDefaults(panelWindow);

  panelWindow.on("close", () => {
    notifyOverlayState();
  });

  panelWindow.on("closed", () => {
    panelWindow = null;
    notifyOverlayState();
  });

  await loadWindowRoute(panelWindow, "/overlay");
  applyOverlayWindowMode(
    panelWindow,
    "panel",
    calculateInitialOverlayBounds("panel", targetDisplay)
  );
  panelWindow.hide();

  return panelWindow;
}

async function ensureOverlayWindow(mode = overlayMode, options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  overlayMode = normalizedMode;

  if (normalizedMode === "launcher") {
    const windows = await ensureLauncherWindows();
    return windows[0] || null;
  }

  return ensurePanelWindow(options);
}

function hideLauncherWindows() {
  for (const browserWindow of launcherWindows.values()) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.hide();
    }
  }
}

function showLauncherWindows() {
  for (const browserWindow of launcherWindows.values()) {
    if (!browserWindow || browserWindow.isDestroyed()) {
      continue;
    }

    browserWindow.setAlwaysOnTop(true, "screen-saver");
    browserWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (typeof browserWindow.showInactive === "function") {
      browserWindow.showInactive();
    } else {
      browserWindow.show();
    }
  }
}

function getMainWindow() {
  return mainWindow;
}

function getOverlayWindow() {
  return getPrimaryOverlayWindow();
}

function setOverlayMode(mode = "launcher", options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  overlayMode = normalizedMode;

  if (normalizedMode === "launcher") {
    hideLauncherWindows();

    if (panelWindow && !panelWindow.isDestroyed()) {
      const panelDisplay = resolveDisplayFromWindow(panelWindow);
      panelWindow.hide();

      const launcherWindow = launcherWindows.get(String(panelDisplay.id));

      if (launcherWindow && !launcherWindow.isDestroyed()) {
        applyOverlayWindowMode(
          launcherWindow,
          "launcher",
          calculateClampedBounds("launcher", panelDisplay, panelWindow.getBounds())
        );
      }
    }

    return notifyOverlayState();
  }

  if (panelWindow && !panelWindow.isDestroyed()) {
    const targetDisplay = options.sender
      ? resolveDisplayFromSender(options.sender)
      : resolveDisplayFromWindow(panelWindow);

    panelWindow.__overlayDisplayId = targetDisplay.id;
    applyOverlayWindowMode(
      panelWindow,
      "panel",
      calculateClampedBounds("panel", targetDisplay, panelWindow.getBounds())
    );
  }

  return notifyOverlayState();
}

async function showOverlayWindow(mode = overlayMode, options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  await ensureOverlayWindow(normalizedMode, options);
  overlayMode = normalizedMode;

  if (normalizedMode === "launcher") {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.hide();
    }

    showLauncherWindows();
    return notifyOverlayState();
  }

  hideLauncherWindows();

  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.setAlwaysOnTop(true, "screen-saver");
    panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    panelWindow.show();
    panelWindow.focus();
  }

  return notifyOverlayState();
}

function hideOverlayWindow() {
  for (const browserWindow of getOverlayWindows()) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.hide();
    }
  }

  return notifyOverlayState();
}

function moveOverlayWindow(nextX, nextY, sender = null) {
  const sourceWindow = sender
    ? BrowserWindow.fromWebContents(sender)
    : getPrimaryOverlayWindow();

  if (!sourceWindow || sourceWindow.isDestroyed()) {
    return getOverlayState();
  }

  const display = resolveDisplayFromWindow(sourceWindow);
  const currentBounds = sourceWindow.getBounds();
  const x = clamp(
    Math.round(nextX),
    display.workArea.x + 12,
    display.workArea.x + display.workArea.width - currentBounds.width - 12
  );
  const y = clamp(
    Math.round(nextY),
    display.workArea.y + 12,
    display.workArea.y + display.workArea.height - currentBounds.height - 12
  );

  sourceWindow.setPosition(x, y, true);
  lastActiveDisplayId = display.id;

  return notifyOverlayState();
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function broadcastToWindows(channel, payload) {
  for (const browserWindow of [mainWindow, ...getOverlayWindows()]) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send(channel, payload);
    }
  }
}

module.exports = {
  broadcastToWindows,
  createMainWindow,
  ensureOverlayWindow,
  focusMainWindow,
  getMainWindow,
  getOverlayState,
  getOverlayWindow,
  hideOverlayWindow,
  moveOverlayWindow,
  notifyOverlayState,
  setOverlayMode,
  showOverlayWindow,
};
