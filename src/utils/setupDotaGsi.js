const GSI_FILE_NAME = "gamestate_integration_dota_helper.cfg";

async function getExistingDirectoryHandle(parentHandle, name) {
  try {
    return await parentHandle.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

async function hasExistingFile(parentHandle, name) {
  try {
    await parentHandle.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function resolveBrowserGsiDirectory(selectedHandle) {
  if (selectedHandle.name === "gamestate_integration") {
    return selectedHandle;
  }

  if (selectedHandle.name === "cfg") {
    return selectedHandle.getDirectoryHandle("gamestate_integration", { create: true });
  }

  const nestedCfgHandle = await getExistingDirectoryHandle(selectedHandle, "cfg");
  if (nestedCfgHandle) {
    return nestedCfgHandle.getDirectoryHandle("gamestate_integration", { create: true });
  }

  const nestedDotaHandle = await getExistingDirectoryHandle(selectedHandle, "dota");
  if (nestedDotaHandle) {
    const cfgHandle = await nestedDotaHandle.getDirectoryHandle("cfg", { create: true });
    return cfgHandle.getDirectoryHandle("gamestate_integration", { create: true });
  }

  const gameHandle = await getExistingDirectoryHandle(selectedHandle, "game");
  if (gameHandle) {
    const dotaHandle = await getExistingDirectoryHandle(gameHandle, "dota");
    if (!dotaHandle) {
      return null;
    }

    const cfgHandle = await dotaHandle.getDirectoryHandle("cfg", { create: true });
    return cfgHandle.getDirectoryHandle("gamestate_integration", { create: true });
  }

  const hasDotaShell = await hasExistingFile(selectedHandle, "dota.sh");
  if (hasDotaShell) {
    const nextGameHandle = await selectedHandle.getDirectoryHandle("game");
    const nextDotaHandle = await nextGameHandle.getDirectoryHandle("dota");
    const nextCfgHandle = await nextDotaHandle.getDirectoryHandle("cfg", { create: true });
    return nextCfgHandle.getDirectoryHandle("gamestate_integration", { create: true });
  }

  return null;
}

async function writeBrowserConfigFile(directoryHandle, content) {
  const fileHandle = await directoryHandle.getFileHandle(GSI_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

function downloadBrowserConfigFile(content, message) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = GSI_FILE_NAME;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);

  return {
    ok: true,
    filePath: GSI_FILE_NAME,
    message,
  };
}

async function setupDotaGsi(content) {
  if (window.electronAPI?.gsi?.setupDotaConfig) {
    return window.electronAPI.gsi.setupDotaConfig();
  }

  if (typeof window.showDirectoryPicker !== "function") {
    return downloadBrowserConfigFile(
      content,
      "Downloaded the GSI config file. Place it in game/dota/cfg/gamestate_integration."
    );
  }

  try {
    const selectedHandle = await window.showDirectoryPicker({
      mode: "readwrite",
    });
    const gsiDirectoryHandle = await resolveBrowserGsiDirectory(selectedHandle);

    if (!gsiDirectoryHandle) {
      return downloadBrowserConfigFile(
        content,
        "That folder did not match a Dota install, so the config file was downloaded instead."
      );
    }

    await writeBrowserConfigFile(gsiDirectoryHandle, content);

    return {
      ok: true,
      filePath: `${gsiDirectoryHandle.name}/${GSI_FILE_NAME}`,
      message: "Created the GSI config file in the selected folder.",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        canceled: true,
        message: "Auto setup canceled.",
      };
    }

    return {
      ok: false,
      canceled: false,
      message: error?.message || "Failed to create the Dota GSI config file.",
    };
  }
}

export { GSI_FILE_NAME, setupDotaGsi };
