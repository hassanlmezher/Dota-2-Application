const { BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createOverlayWindow } = require("./overlayWindow.js");

const preloadPath = path.join(__dirname, "preload.js");
const distIndexPath = path.join(__dirname, "..", "dist", "index.html");

let mainWindow = null;
let overlayWindow = null;

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
    backgroundColor: "#070b16",
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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  return mainWindow;
}

async function ensureOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayWindow = createOverlayWindow({
    preloadPath,
  });

  attachWindowDefaults(overlayWindow);

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  await overlayWindow.loadURL(resolveRendererTarget("/overlay"));
  return overlayWindow;
}

function getMainWindow() {
  return mainWindow;
}

function getOverlayWindow() {
  return overlayWindow;
}

function showOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.showInactive();
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function hideOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.hide();
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
  getMainWindow,
  getOverlayWindow,
  hideOverlayWindow,
  showOverlayWindow,
};
