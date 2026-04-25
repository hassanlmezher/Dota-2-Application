const { BrowserWindow } = require("electron");

function createOverlayWindow({ preloadPath, bounds }) {
  const overlayWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    show: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    fullscreenable: false,
    acceptFirstMouse: true,
    alwaysOnTop: true,
    title: "Dota Helper Overlay",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  return overlayWindow;
}

module.exports = { createOverlayWindow };
