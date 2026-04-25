const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  app: {
    getInfo: () => ipcRenderer.invoke("app:get-info"),
  },
  gsi: {
    start: () => ipcRenderer.invoke("gsi:start"),
    getState: () => ipcRenderer.invoke("gsi:get-latest-state"),
    getStatus: () => ipcRenderer.invoke("gsi:get-status"),
    onState: (callback) => subscribe("gsi:state", callback),
    onStatus: (callback) => subscribe("gsi:status", callback),
  },
  window: {
    toggleOverlay: () => ipcRenderer.invoke("window:toggle-overlay"),
    showOverlay: (mode) => ipcRenderer.invoke("window:show-overlay", mode),
    hideOverlay: () => ipcRenderer.invoke("window:hide-overlay"),
    getOverlayState: () => ipcRenderer.invoke("window:get-overlay-state"),
    setOverlayMode: (mode) => ipcRenderer.invoke("window:set-overlay-mode", mode),
    focusMain: () => ipcRenderer.invoke("window:focus-main"),
    onOverlayState: (callback) => subscribe("overlay:state", callback),
  },
});
