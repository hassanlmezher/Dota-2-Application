const { app, ipcMain } = require("electron");
const { createGsiServer } = require("./gsiServer.js");
const {
  broadcastToWindows,
  createMainWindow,
  ensureOverlayWindow,
  focusMainWindow,
  getOverlayState,
  getOverlayWindow,
  hideOverlayWindow,
  notifyOverlayState,
  setOverlayMode,
  showOverlayWindow,
} = require("./windowManager.js");

const GSI_PORT = Number(process.env.VITE_GSI_PORT || 3001);

let latestMatchState = null;
let gsiServer = null;

function registerIpcHandlers() {
  ipcMain.handle("app:get-info", () => ({
    isPackaged: app.isPackaged,
    versions: process.versions,
    gsiPort: GSI_PORT,
  }));

  ipcMain.handle("gsi:start", async () => {
    if (!gsiServer) {
      gsiServer = createGsiServer({ port: GSI_PORT });
      gsiServer.on("state", handleGsiState);
      gsiServer.on("status", (status) => {
        broadcastToWindows("gsi:status", status);
      });
    }

    return gsiServer.start();
  });

  ipcMain.handle("gsi:get-latest-state", () => latestMatchState);
  ipcMain.handle("gsi:get-status", () => gsiServer?.getStatus() || {
    running: false,
    host: "127.0.0.1",
    port: GSI_PORT,
    endpoint: `http://127.0.0.1:${GSI_PORT}/gsi`,
  });

  ipcMain.handle("window:toggle-overlay", async () => {
    if (getOverlayState().visible) {
      return hideOverlayWindow();
    }

    const overlayWindow = await ensureOverlayWindow("launcher");

    if (latestMatchState) {
      overlayWindow.webContents.send("gsi:state", latestMatchState);
    }

    showOverlayWindow("launcher");
    return getOverlayState();
  });

  ipcMain.handle("window:show-overlay", async (_event, mode = "launcher") => {
    const overlayWindow = await ensureOverlayWindow(mode);

    if (latestMatchState) {
      overlayWindow.webContents.send("gsi:state", latestMatchState);
    }

    showOverlayWindow(mode);
    return getOverlayState();
  });

  ipcMain.handle("window:hide-overlay", () => {
    return hideOverlayWindow();
  });

  ipcMain.handle("window:get-overlay-state", () => getOverlayState());

  ipcMain.handle("window:set-overlay-mode", async (_event, mode) => {
    const overlayWindow = await ensureOverlayWindow(mode);

    if (latestMatchState) {
      overlayWindow.webContents.send("gsi:state", latestMatchState);
    }

    setOverlayMode(mode);
    showOverlayWindow(mode);
    return getOverlayState();
  });

  ipcMain.handle("window:focus-main", () => {
    focusMainWindow();
    return true;
  });
}

function handleGsiState(nextState) {
  latestMatchState = nextState;
  broadcastToWindows("gsi:state", nextState);
}

async function bootstrap() {
  registerIpcHandlers();
  await createMainWindow();

  gsiServer = createGsiServer({ port: GSI_PORT });
  gsiServer.on("state", handleGsiState);
  gsiServer.on("status", (status) => {
    broadcastToWindows("gsi:status", status);
  });
  await gsiServer.start();
  notifyOverlayState();
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  await createMainWindow();
});

app.on("before-quit", async () => {
  if (gsiServer) {
    await gsiServer.stop();
  }
});
