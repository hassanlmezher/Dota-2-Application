const { app, ipcMain } = require("electron");
const { createGsiServer } = require("./gsiServer.js");
const {
  broadcastToWindows,
  createMainWindow,
  ensureOverlayWindow,
  getOverlayWindow,
  hideOverlayWindow,
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
    if (getOverlayWindow()?.isVisible()) {
      hideOverlayWindow();
      return { visible: false };
    }

    const overlayWindow = await ensureOverlayWindow();

    if (latestMatchState) {
      overlayWindow.webContents.send("gsi:state", latestMatchState);
    }

    showOverlayWindow();
    return { visible: true };
  });

  ipcMain.handle("window:show-overlay", async () => {
    const overlayWindow = await ensureOverlayWindow();

    if (latestMatchState) {
      overlayWindow.webContents.send("gsi:state", latestMatchState);
    }

    showOverlayWindow();
    return { visible: true };
  });

  ipcMain.handle("window:hide-overlay", () => {
    hideOverlayWindow();
    return { visible: false };
  });
}

function handleGsiState(nextState) {
  latestMatchState = nextState;
  broadcastToWindows("gsi:state", nextState);

  ensureOverlayWindow()
    .then((overlayWindow) => {
      overlayWindow.webContents.send("gsi:state", nextState);
      if (!overlayWindow.isVisible()) {
        showOverlayWindow();
      }
    })
    .catch((error) => {
      console.error("Failed to update overlay window:", error);
    });
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
