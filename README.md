# Dota Helper App

Desktop Dota 2 matchmaking helper built with Electron, React, Vite, and Supabase.

## Features

- Counter-pick assistant powered by the `get_best_counter_picks` Supabase RPC
- Item recommendation assistant powered by the `get_best_items_to_buy` Supabase RPC
- Always-on-top match overlay fed by local Dota 2 Game State Integration (GSI)
- Supabase-backed hero and item selectors
- Microsoft Store-ready Windows packaging via `electron-builder` `appx`

## Environment

Set the public client credentials in [.env](/Users/hassanmezher/Desktop/dota-importer/.env:1):

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GSI_PORT=3001
```

Keep the service-role key only for your import scripts and never expose it in the renderer.

## Development

```bash
npm install
npm run dev
```

This starts:

- Vite renderer on `http://127.0.0.1:5173`
- Electron main process
- Local GSI server on `http://127.0.0.1:3001`

## Packaging

```bash
npm run build
npm run windows
npm run mac
```

`windows` builds an `appx` package. Before publishing to Microsoft Store, replace the placeholder `identityName`, `publisher`, and display metadata in [electron-builder.json](/Users/hassanmezher/Desktop/dota-importer/electron-builder.json:1).

## Dota 2 GSI Setup

Create a file like:

`<SteamLibrary>/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_dota_helper.cfg`

Suggested contents:

```txt
"DotaHelper"
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
}
```

## Notes About RPC Arguments

The frontend tries several common argument names when calling the stored functions so it can adapt to minor naming differences in your SQL definitions. If your RPC signatures are custom, adjust [src/api/counterPicksApi.js](/Users/hassanmezher/Desktop/dota-importer/src/api/counterPicksApi.js:1) and [src/api/itemsApi.js](/Users/hassanmezher/Desktop/dota-importer/src/api/itemsApi.js:1).
