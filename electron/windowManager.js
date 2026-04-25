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
let overlayWindow = null;
let overlayMode = "launcher";

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

function attachWindowDefaults(browserWindow) {
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function getOverlayModeSize(mode = overlayMode) {
  return OVERLAY_MODES[mode] || OVERLAY_MODES.launcher;
}

function getOverlayVisibility() {
  return Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible());
}

function getOverlayState() {
  return {
    visible: getOverlayVisibility(),
    mode: overlayMode,
  };
}

function calculateInitialOverlayBounds(mode = overlayMode) {
  const display = screen.getPrimaryDisplay().workArea;
  const size = getOverlayModeSize(mode);

  return {
    width: size.width,
    height: size.height,
    x: display.x + display.width - size.width - 24,
    y: display.y + Math.round((display.height - size.height) / 2),
  };
}

function getOverlayDisplayArea() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return screen.getPrimaryDisplay().workArea;
  }

  return screen.getDisplayMatching(overlayWindow.getBounds()).workArea;
}

function calculateBoundsForMode(mode) {
  const display = getOverlayDisplayArea();
  const size = getOverlayModeSize(mode);
  const current = overlayWindow?.getBounds?.() || calculateInitialOverlayBounds(mode);
  const currentRight = current.x + current.width;
  const currentY = current.y;

  const nextX = clamp(
    currentRight - size.width,
    display.x + 12,
    display.x + display.width - size.width - 12
  );

  const nextY = clamp(
    mode === "panel" ? currentY - 36 : currentY,
    display.y + 12,
    display.y + display.height - size.height - 12
  );

  return {
    width: size.width,
    height: size.height,
    x: nextX,
    y: nextY,
  };
}

function moveOverlayWindow(nextX, nextY) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return getOverlayState();
  }

  const display = getOverlayDisplayArea();
  const currentBounds = overlayWindow.getBounds();
  const x = clamp(
    Math.round(nextX),
    display.x + 12,
    display.x + display.width - currentBounds.width - 12
  );
  const y = clamp(
    Math.round(nextY),
    display.y + 12,
    display.y + display.height - currentBounds.height - 12
  );

  overlayWindow.setPosition(x, y, true);
  return notifyOverlayState();
}

function notifyOverlayState() {
  const state = getOverlayState();

  for (const browserWindow of [mainWindow, overlayWindow]) {
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

  await mainWindow.loadURL(resolveRendererTarget("/"));
  notifyOverlayState();
  return mainWindow;
}

async function ensureOverlayWindow(mode = overlayMode) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (mode !== overlayMode) {
      setOverlayMode(mode);
    }

    return overlayWindow;
  }

  overlayMode = mode;
  overlayWindow = createOverlayWindow({
    preloadPath,
    bounds: calculateInitialOverlayBounds(mode),
  });

  attachWindowDefaults(overlayWindow);

  overlayWindow.on("close", () => {
    notifyOverlayState();
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayMode = "launcher";
    notifyOverlayState();
  });

  await overlayWindow.loadURL(resolveRendererTarget("/overlay"));
  setOverlayMode(mode);
  notifyOverlayState();

  return overlayWindow;
}

function getMainWindow() {
  return mainWindow;
}

function getOverlayWindow() {
  return overlayWindow;
}

function setOverlayMode(mode = "launcher") {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    overlayMode = mode;
    return getOverlayState();
  }

  overlayMode = mode in OVERLAY_MODES ? mode : "launcher";
  const bounds = calculateBoundsForMode(overlayMode);

  overlayWindow.setMinimumSize(bounds.width, bounds.height);
  overlayWindow.setMaximumSize(bounds.width, bounds.height);
  overlayWindow.setBounds(bounds, true);
  overlayWindow.setResizable(false);
  overlayWindow.setFocusable(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  return notifyOverlayState();
}

function showOverlayWindow(mode = overlayMode) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  setOverlayMode(mode);
  overlayWindow.show();
  overlayWindow.focus();
  notifyOverlayState();
}

function hideOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return getOverlayState();
  }

  overlayWindow.hide();
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
  for (const browserWindow of [mainWindow, overlayWindow]) {
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
