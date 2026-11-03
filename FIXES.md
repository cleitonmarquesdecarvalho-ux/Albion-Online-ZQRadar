# Build, modernization, and runtime changes

## Windows environment verified

- Npcap 1.90: WinPcap API compatibility enabled; raw 802.11 support disabled; service `npcap` was RUNNING after restart.
- Node.js 26.13.0 LTS, npm 11.20.0.
- Python 3.15.0; `PYTHON` points at its direct `python.exe` for node-gyp.
- Visual Studio Build Tools 2022 17.14.44, MSVC v143, Windows SDK 10.0.26100.0, and ClangCL components. The Node 26 `cap` project selected the ClangCL toolset, so adding ClangCL was needed to build without downgrading Node.
- `npm config get msvs_version` is `undefined`; node-gyp autodetects the installed VS 2022 toolchain. `scripts/check-env.ps1` checks these prerequisites.

## Dependency changes from branch `old-radar-dev` baseline

| Package | Baseline | Current | Reason / compatibility notes |
|---|---:|---:|---|
| `buffercursor` | ^0.0.12 | ^0.0.12 | No change; parser still depends on its cursor behavior. |
| `cap` | ^0.2.1 | ^0.2.1 | No source upgrade; native addon rebuilt successfully with Node 26 after installing ClangCL. It still depends on Npcap and may need toolchain work on future Node ABI changes. |
| `ejs` | ^3.1.9 | ^7.0.2 | Major update. EJS 7 no longer treats Express render locals/app locals as EJS options. This app passes `mainContent` as render data, and the current home template rendered successfully. |
| `express` | ^4.18.2 | ^5.3.0 | Major update. Express 5 changes route/path parsing and async error propagation. This app uses simple literal routes and the smoke-tested home route. |
| `nan` | ^2.18.0 | ^2.30.0 | Newer NAN/V8 compatibility headers; the previous version failed compiling `cap` against Node 26. |
| `node-gyp` | ^10.0.1 | ^13.1.0 | The older generation failed against Node 26's Windows configuration. v13 completed the native build. |
| `node-sass` | ^9.0.0 | removed | No source usage; deprecated native dependency and unnecessary build path. |
| `npm` | ^10.2.3 | removed | Package should not install a second npm copy into the application. System npm is used. |
| `path` | ^0.12.7 | removed | App uses Node's built-in `path` module. |
| `readline-sync` | ^1.4.10 | removed | Replaced with built-in `node:readline/promises` and loopback-filtered adapter selection. |
| `ws` | ^8.14.2 | ^8.22.1 | Updated within major 8; existing WebSocket API remains compatible. |

`npm install` and `npm audit` currently complete with 0 reported vulnerabilities. npm audit results describe the current registry advisory database and can change over time.

## Build failure and repair sequence

1. `cap@0.2.1` first failed with MSB8020 because Node 26 selected ClangCL and it was absent. Installed VS components `Microsoft.VisualStudio.Component.VC.Llvm.Clang` and `Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset`.
2. `node-gyp@10.0.1` then failed while processing the Node 26 config (`node.profdata`). Upgraded node-gyp to 13.1.0.
3. `nan@2.18.0` then failed compiling against the newer V8 `ScriptOrigin` API. Upgraded NAN to 2.30.0.
4. npm 11 initially withheld install scripts until explicit approval. Approved the `cap@0.2.1` native build script; `npm rebuild cap --foreground-scripts` completed and produced `node_modules/cap/build/Release/cap.node`.
5. Removed unused `node-sass`, `npm`, and `path` dependencies. The resulting clean install reports zero audit findings.

## Runtime and protocol observations

- The app was launched elevated and the home interface loaded at `http://localhost:5001`. The machine's default-route adapter was Ethernet `192.168.18.185`; loopback `127.0.0.1` was not the capture interface. Radmin VPN was another listed interface and should be selected only if traffic actually routes through it.
- HTTP and WebSocket listeners now bind to loopback only. Startup errors for absent capture devices and occupied ports are rendered as short log/console messages. Packet decode exceptions are logged rather than silently swallowed.
- The old selector included loopback, used sync input, and cached the address. It now uses `readline/promises`, excludes internal/loopback addresses, validates choices, and re-prompts when the saved device disappears.
- `/logout` called `req.session.destroy()` despite the absence of session middleware; it now redirects without throwing. This branch does not contain Discord OAuth, login flow, auth settings, or session middleware. There is no real Discord authentication failure to handle until that feature/configuration exists.
- The branch uses its own parser under `scripts/classes/`; `photon-packet-parser` is only an old README credit and not an installed dependency/import in this branch. Rewriting to another parser is not justified from package-name assumptions.
- A current-session capture was made locally on 2026-11-03: the Realtek adapter (`192.168.18.185`) received 533 UDP/5056 datagrams in 12 seconds; Radmin VPN and loopback received none. Eight saved raw datagrams decoded as Protocol18 events, while the old Protocol16 parser rejected custom type bytes such as `0x8a`.
- The runtime parser was replaced with a Protocol18 reader and validated against saved packets and live traffic. Live WebSocket checks observed thousands of decoded events, movement requests on operation 22, and spawn events 29, 39, 40, and 123. Current event mappings were updated where the local Protocol18 reference and live capture support them; uncertain handlers are disabled with `-1` until captured.
- Current `NewCharacter` event 29 was observed with parameters 14 absent. The old handler dereferenced `Parameters[14]` and could throw. It now avoids a guessed player location. Player Move positions are encrypted, so this passive capture cannot reliably draw player movement.
- After a zone transition with the app already running, the browser canvas rendered mobs/resources over the grid. The live stream still contained no JoinFinished/ChangeCluster response, so the map ID stayed unset and map tiles did not appear. Entity rendering is verified; map-background selection remains unverified.
- The Protocol18 Move packet contains coordinates for mobs/resources and encrypted coordinates for players in the same raw event family. The parser exposes decoded float positions for existing handlers, but player positions cannot be distinguished solely by the passive coordinates when XOR happens to produce finite values. Player map-position rendering is deliberately skipped; the identity/equipment list is implemented separately.
- The drawing view now lists players from verified NewCharacter parameters (nickname, guild, alliance, faction, equipment and spells) without inventing map coordinates. Live player dots remain disabled because passive player movement is encrypted.
- Rendering was made lighter by deduplicating in-flight image requests, switching interpolation to a time-based smoothing factor, pruning harvestables at 4 Hz rather than every animation frame, removing 300 ms localStorage polling, and avoiding a per-frame copy of the footprints array.
- Single-file packaging is not yet validated. The existing `nexe` command may not bundle the native `cap` addon, Npcap dependency, EJS templates, and static assets correctly; it needs a separate packaging experiment before claiming a working EXE.

## Source remote

The local repository was cloned from the archived upstream branch because no personal fork URL was supplied. The remote is named `upstream`; set `origin` to the user's fork before pushing.

## Player equipment icons

- Added 2,782 local WebP item icons from the MIT-licensed OpenRadar asset pack. Attribution and the source commit are recorded in `images/Items/ASSET-SOURCE.md`; the license is included beside the assets.
- Fixed the startup race: player equipment now receives the item-ID catalog after `items.txt` finishes loading.
- Player gear drawing now uses local WebP assets and supports PNG assets for item IDs absent from the WebP pack. Two missing furniture icons were added from the Albion item renderer (`render.albiononline.com`).
- This removes the blue missing-image circles for the shown equipment. Unmapped or newly added game items can still require updated `items.txt` mappings and an icon asset.

## Player awareness panel

- The Drawing player panel now shows the verified faction label, equipment/ability counts, health when received, and mount state when received.
- New hostile-player detections produce a temporary visible alert. The existing Players -> Sound option now plays the bundled `sounds/player.mp3` for a newly detected hostile.
- Exact player dots and distance are still unavailable from this passive capture path; this change does not estimate coordinates.

## Player list on page reconnect

- The backend now keeps up to 100 recent `NewCharacter` (event 29) payloads and replays them to newly connected Drawing pages, so opening/reloading the page no longer loses players whose spawn event arrived earlier in the running session.
- `Leave` (event 1) removes that player from the snapshot. Observed map/join responses 41 and 2 clear the cache to avoid replaying a previous zone's players.
- The cache starts empty when `app.js` restarts and can only contain players whose `NewCharacter` event was captured during that server session. Players already present before startup cannot be reconstructed until the client receives their spawn event.
- Snapshot replay uses the same player parser and ignore-list filters, while suppressing duplicate hostile alerts.

## Drawing player list overlay

- Moved the detected-player panel onto the upper-left of the map canvas with a translucent background and bounded scroll area. The equipment canvas now sits beside the map on wide screens and below it on narrow screens.
- The panel is an overlay only. It does not imply player coordinates or movement.
- Protocol research found the live positions have an extra XOR layer, while the key-sync state needed to undo it is carried inside encrypted Photon traffic. Current public OpenRadar research reports no reliable passive cold-start source for that state; exact positions remain unavailable to this passive parser. References: https://github.com/Nouuu/Albion-Online-OpenRadar/blob/main/docs/technical/PLAYER_POSITIONS_MITM.md and https://github.com/Nouuu/Albion-Online-OpenRadar/issues/218.
- A live sample of 1,115 Move events and 163 local position requests confirmed the encrypted player coordinates decode to non-position values; correlation with the local player's coordinates did not produce a stable, validated position key.

- Replaced the stale player item-ID catalog with the current catalog from OpenRadar's MIT-licensed item data at commit `2786827386ee31d37d5a6068b965f42d589fe946`; the old mapping mislabeled live IDs after game updates.
- Equipment icons now retain their 10-slot positions, so empty offhand/bag/cape/etc. slots no longer shift the following item icons.
