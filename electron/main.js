const {
  app,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
  session,
  shell,
  systemPreferences,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createGsiServer } = require("./gsiServer.js");
const {
  broadcastToWindows,
  createMainWindow,
  ensureOverlayWindow,
  focusMainWindow,
  getOverlayState,
  hideOverlayWindow,
  moveOverlayWindow,
  notifyOverlayState,
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
    "allplayers"  "1"
    "allheroes"   "1"
    "hero"        "1"
    "player"      "1"
    "items"       "1"
    "abilities"   "1"
  }
}
`;

let latestMatchState = null;
let gsiServer = null;
let preferredCaptureSourceId = null;
const remoteImageDataUrlCache = new Map();

app.commandLine.appendSwitch("disable-renderer-backgrounding");

function getScreenAccessStatus() {
  if (process.platform === "darwin") {
    return systemPreferences.getMediaAccessStatus("screen");
  }

  return "granted";
}

function normalizeCaptureSource(source) {
  return {
    id: source.id,
    name: source.name,
    displayId: source.display_id || null,
    kind: source.id.startsWith("window:") ? "window" : "screen",
  };
}

async function getCaptureSources() {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    fetchWindowIcons: false,
    thumbnailSize: {
      width: 0,
      height: 0,
    },
  });

  return sources;
}

function isLikelyDotaSource(source) {
  return /dota\s*2|dota/i.test(source?.name || "");
}

function pickBestCaptureSource(sources = []) {
  if (!sources.length) {
    return null;
  }

  const preferredSource = preferredCaptureSourceId
    ? sources.find((source) => source.id === preferredCaptureSourceId)
    : null;

  if (preferredSource) {
    return preferredSource;
  }

  const dotaWindow = sources.find(
    (source) => source.id.startsWith("window:") && isLikelyDotaSource(source)
  );

  if (dotaWindow) {
    return dotaWindow;
  }

  const dotaScreen = sources.find(
    (source) => source.id.startsWith("screen:") && isLikelyDotaSource(source)
  );

  if (dotaScreen) {
    return dotaScreen;
  }

  const primaryScreen = screen
    .getAllDisplays()
    .find((display) => display.bounds.x === 0 && display.bounds.y === 0);

  if (primaryScreen) {
    const matchingPrimaryScreen = sources.find(
      (source) =>
        source.id.startsWith("screen:") &&
        String(source.display_id || "") === String(primaryScreen.id)
    );

    if (matchingPrimaryScreen) {
      return matchingPrimaryScreen;
    }
  }

  const firstScreen = sources.find((source) => source.id.startsWith("screen:"));

  return firstScreen || sources[0] || null;
}

function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await getCaptureSources();
      const source = pickBestCaptureSource(sources);

      if (!source) {
        callback({});
        return;
      }

      callback({ video: source });
    } catch (error) {
      console.error("Failed to resolve display media source", error);
      callback({});
    }
  });
}

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
    appName: app.getName(),
    capturePermissionTarget: app.isPackaged ? app.getName() : "Electron",
    versions: process.versions,
    gsiPort: GSI_PORT,
  }));
  ipcMain.handle("app:relaunch", () => {
    app.relaunch();
    app.exit(0);
    return true;
  });

  ipcMain.handle("capture:get-screen-access-status", () => getScreenAccessStatus());
  ipcMain.handle("capture:list-sources", async () => {
    const sources = await getCaptureSources();
    return sources.map(normalizeCaptureSource);
  });
  ipcMain.handle("capture:set-preferred-source", async (_event, sourceId) => {
    preferredCaptureSourceId = sourceId || null;
    return {
      ok: true,
      preferredCaptureSourceId,
    };
  });
  ipcMain.handle("capture:get-preferred-source", () => preferredCaptureSourceId);
  ipcMain.handle("capture:open-screen-recording-settings", async () => {
    if (process.platform !== "darwin") {
      return { ok: false, message: "This shortcut is only used on macOS." };
    }

    try {
      await shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Failed to open macOS Screen Recording settings.",
      };
    }
  });

  ipcMain.handle("assets:fetch-remote-image-data-url", async (_event, url) => {
    if (!url || typeof url !== "string") {
      return {
        ok: false,
        message: "A remote image URL is required.",
      };
    }

    if (remoteImageDataUrlCache.has(url)) {
      return {
        ok: true,
        dataUrl: remoteImageDataUrlCache.get(url),
      };
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch remote image (${response.status}).`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const arrayBuffer = await response.arrayBuffer();
      const dataUrl = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;

      remoteImageDataUrlCache.set(url, dataUrl);

      return {
        ok: true,
        dataUrl,
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Failed to fetch remote image.",
      };
    }
  });

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

    await ensureOverlayWindow("launcher");

    if (latestMatchState) {
      broadcastToWindows("gsi:state", latestMatchState);
    }

    await showOverlayWindow("launcher");
    return getOverlayState();
  });

  ipcMain.handle("window:show-overlay", async (event, mode = "launcher") => {
    await ensureOverlayWindow(mode, { sender: event.sender });

    if (latestMatchState) {
      broadcastToWindows("gsi:state", latestMatchState);
    }

    await showOverlayWindow(mode, { sender: event.sender });
    return getOverlayState();
  });

  ipcMain.handle("window:hide-overlay", () => {
    return hideOverlayWindow();
  });

  ipcMain.handle("window:get-overlay-state", () => getOverlayState());

  ipcMain.handle("window:set-overlay-mode", async (event, mode) => {
    await ensureOverlayWindow(mode, { sender: event.sender });

    if (latestMatchState) {
      broadcastToWindows("gsi:state", latestMatchState);
    }

    await showOverlayWindow(mode, { sender: event.sender });
    return getOverlayState();
  });

  ipcMain.handle("window:move-overlay", (event, coordinates) => {
    return moveOverlayWindow(coordinates?.x, coordinates?.y, event.sender);
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
  registerDisplayMediaHandler();
  await createMainWindow();
  await ensureOverlayWindow("launcher");
  hideOverlayWindow();
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
