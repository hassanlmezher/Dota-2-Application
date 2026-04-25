import { BrowserWindow, screen } from "electron";

function createOverlayWindow({ preloadPath }) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const overlayWindow = new BrowserWindow({
    width: Math.min(460, width),
    height: Math.min(780, height),
    x: Math.max(width - 500, 24),
    y: 24,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    show: false,
    skipTaskbar: true,
    focusable: false,
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

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.once("ready-to-show", () => {
    overlayWindow.showInactive();
  });

  return overlayWindow;
}

export { createOverlayWindow };
