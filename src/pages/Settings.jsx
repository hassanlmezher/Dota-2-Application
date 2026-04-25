import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { hasCredentials } from "../api/supabaseClient";

const gsiConfigSnippet = `"DotaHelper"
{
  "uri"           "http://127.0.0.1:3001/gsi"
  "timeout"       "5.0"
  "buffer"        "0.1"
  "throttle"      "0.1"
  "heartbeat"     "30.0"
  "data"
  {
    "provider"    "1"
    "map"         "1"
    "hero"        "1"
    "player"      "1"
    "items"       "1"
    "abilities"   "1"
  }
}`;

export default function Settings() {
  const gsi = useOutletContext();
  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAppInfo() {
      if (!window.electronAPI?.app?.getInfo) {
        return;
      }

      const nextInfo = await window.electronAPI.app.getInfo();

      if (isMounted) {
        setAppInfo(nextInfo);
      }
    }

    loadAppInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Desktop runtime and GSI wiring</h1>
          <p className="page-lead">
            Verify the client env, inspect the local GSI server state, and copy the
            Dota integration config.
          </p>
        </div>
      </div>

      <div className="page-grid page-grid--two-column">
        <article className="panel">
          <div className="section-heading">
            <h2>Runtime Status</h2>
            <span>{window.electronAPI?.isElectron ? "Electron" : "Browser"}</span>
          </div>

          <div className="settings-list">
            <div className="settings-row">
              <span>Supabase env</span>
              <strong>{hasCredentials ? "Configured" : "Missing"}</strong>
            </div>
            <div className="settings-row">
              <span>GSI server</span>
              <strong>{gsi?.serverStatus?.running ? "Listening" : "Stopped"}</strong>
            </div>
            <div className="settings-row">
              <span>Endpoint</span>
              <strong>{gsi?.serverStatus?.endpoint || "Unavailable"}</strong>
            </div>
            <div className="settings-row">
              <span>Packaged app</span>
              <strong>{appInfo?.isPackaged ? "Yes" : "No"}</strong>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => window.electronAPI?.window?.toggleOverlay?.()}
            >
              Toggle Overlay
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <h2>GSI Config</h2>
            <span>Dota 2</span>
          </div>

          <p className="page-copy">
            Put this file under the Dota `gamestate_integration` folder and point it
            at your local GSI endpoint.
          </p>

          <pre className="code-block">
            <code>{gsiConfigSnippet}</code>
          </pre>
        </article>
      </div>
    </section>
  );
}
