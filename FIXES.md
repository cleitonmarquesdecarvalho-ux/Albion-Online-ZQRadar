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
- No current-game packet capture was supplied. Therefore opcode/event identifiers, offsets, and structure changes are unverified and were not guessed or edited. The 5056 UDP capture filter was preserved. Confirm protocol changes by exporting captures from the current client/server session and tracing the local parser's output against known in-game events.
- Single-file packaging is not yet validated. The existing `nexe` command may not bundle the native `cap` addon, Npcap dependency, EJS templates, and static assets correctly; it needs a separate packaging experiment before claiming a working EXE.

## Source remote

The local repository was cloned from the archived upstream branch because no personal fork URL was supplied. The remote is named `upstream`; set `origin` to the user's fork before pushing.
