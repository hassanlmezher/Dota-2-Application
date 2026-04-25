const { app, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createGsiServer } = require("./gsiServer.js");
const {
  broadcastToWindows,
  createMainWindow,
  ensureOverlayWindow,
  focusMainWindow,
  getOverlayState,
  getOverlayWindow,
  hideOverlayWindow,
  moveOverlayWindow,
  notifyOverlayState,
  setOverlayMode,
  showOverlayWindow,
} = require("./windowManager.js");

const GSI_PORT = Number(process.env.VITE_GSI_PORT || 3001);
const GSI_FILE_NAME = "gamestate_integration_dota_helper.cfg";
const GSI_CONFIG_CONTENT = `"DotaHelper"
{
  "uri"           "http://127.0.0.1:${GSI_PORT}/gsi"
  "timeout"       "5.0"
  "buffer"        "0.1"
  "throttle"      "0.1"
  "heartbeat"     "30.0"
  "data"
  {
    "provider"    "1"
    "map"         "1"
    "draft"       "1"
    "hero"        "1"
    "player"      "1"
    "items"       "1"
    "abilities"   "1"
  }
}
`;

let latestMatchState = null;
let gsiServer = null;

function getSteamRootCandidates() {
  const homeDirectory = app.getPath("home");

  if (process.platform === "darwin") {
    return [path.join(homeDirectory, "Library", "Application Support", "Steam")];
  }

  if (process.platform === "win32") {
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const programFiles = process.env.ProgramFiles;

    return [
      programFilesX86 && path.join(programFilesX86, "Steam"),
      programFiles && path.join(programFiles, "Steam"),
      path.join(homeDirectory, "AppData", "Local", "Steam"),
      path.join(homeDirectory, "AppData", "Roaming", "Steam"),
    ].filter(Boolean);
  }

  return [
    path.join(homeDirectory, ".steam", "steam"),
    path.join(homeDirectory, ".local", "share", "Steam"),
  ];
}

function normalizeUniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((candidatePath) => path.normalize(candidatePath)))];
}

function decodeVdfPath(rawValue) {
  return path.normalize(rawValue.replace(/\\\\/g, "\\"));
}

function parseSteamLibraryFolders(vdfContent) {
  const libraryRoots = new Set();

  for (const match of vdfContent.matchAll(/"path"\s+"([^"]+)"/g)) {
    const libraryPath = decodeVdfPath(match[1]);

    if (path.isAbsolute(libraryPath)) {
      libraryRoots.add(libraryPath);
    }
  }

  for (const match of vdfContent.matchAll(/"(\d+)"\s+"([^"]+)"/g)) {
    const libraryPath = decodeVdfPath(match[2]);

    if (path.isAbsolute(libraryPath)) {
      libraryRoots.add(libraryPath);
    }
  }

  return [...libraryRoots];
}

function getSteamLibraryRoots() {
  const steamRoots = normalizeUniquePaths(getSteamRootCandidates());
  const discoveredLibraries = new Set(steamRoots);

  for (const steamRoot of steamRoots) {
    if (!fs.existsSync(steamRoot)) {
      continue;
    }

    const libraryManifestCandidates = [
      path.join(steamRoot, "steamapps", "libraryfolders.vdf"),
      path.join(steamRoot, "SteamApps", "libraryfolders.vdf"),
      path.join(steamRoot, "config", "libraryfolders.vdf"),
    ];

    for (const manifestPath of libraryManifestCandidates) {
      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      const manifestContent = fs.readFileSync(manifestPath, "utf8");

      for (const libraryRoot of parseSteamLibraryFolders(manifestContent)) {
        discoveredLibraries.add(libraryRoot);
      }
    }
  }

  return [...discoveredLibraries];
}

function getDotaInstallCandidates() {
  return normalizeUniquePaths(
    getSteamLibraryRoots().flatMap((libraryRoot) => [
      path.join(libraryRoot, "steamapps", "common", "dota 2 beta"),
      path.join(libraryRoot, "SteamApps", "common", "dota 2 beta"),
    ])
  );
}

function resolveGsiDirectoryFromSelection(selectedPath) {
  const normalizedPath = path.resolve(selectedPath);

  const exactGsiDirectory = path.basename(normalizedPath) === "gamestate_integration";
  if (exactGsiDirectory) {
    return normalizedPath;
  }

  const cfgDirectory = path.basename(normalizedPath) === "cfg";
  if (cfgDirectory) {
    return path.join(normalizedPath, "gamestate_integration");
  }

  const dotaRootCandidate = path.join(
    normalizedPath,
    "game",
    "dota",
    "cfg",
    "gamestate_integration"
  );

  if (
    fs.existsSync(path.join(normalizedPath, "game")) ||
    fs.existsSync(path.join(normalizedPath, "dota.sh")) ||
    fs.existsSync(path.join(normalizedPath, "dota"))
  ) {
    return dotaRootCandidate;
  }

  return null;
}

async function chooseDotaFolderInteractively() {
  const result = await dialog.showOpenDialog({
    title: "Select Dota 2 folder or cfg folder",
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use Folder",
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return resolveGsiDirectoryFromSelection(result.filePaths[0]);
}

async function setupDotaGsiConfig() {
  const existingInstall = getDotaInstallCandidates().find((candidatePath) =>
    fs.existsSync(candidatePath)
  );

  let gsiDirectory = existingInstall
    ? path.join(existingInstall, "game", "dota", "cfg", "gamestate_integration")
    : null;

  if (!gsiDirectory) {
    gsiDirectory = await chooseDotaFolderInteractively();
  }

  if (!gsiDirectory) {
    return {
      ok: false,
      canceled: true,
      message: "No Dota 2 folder selected.",
    };
  }

  fs.mkdirSync(gsiDirectory, { recursive: true });

  const filePath = path.join(gsiDirectory, GSI_FILE_NAME);
  fs.writeFileSync(filePath, GSI_CONFIG_CONTENT, "utf8");

  return {
    ok: true,
    filePath,
    message: "Dota GSI config created.",
  };
}

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
    lastReceivedAt: null,
    packetCount: 0,
  });

  ipcMain.handle("gsi:setup-dota-config", async () => {
    try {
      return await setupDotaGsiConfig();
    } catch (error) {
      return {
        ok: false,
        canceled: false,
        message: error?.message || "Failed to create Dota GSI config.",
      };
    }
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

  ipcMain.handle("window:move-overlay", (_event, coordinates) => {
    return moveOverlayWindow(coordinates?.x, coordinates?.y);
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
  await ensureOverlayWindow("launcher");
  hideOverlayWindow();

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
