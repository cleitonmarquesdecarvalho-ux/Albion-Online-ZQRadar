# Albion Online ZQRadar (Windows)

## Requirements

- Windows 11 x64
- Node.js 26 LTS (`.nvmrc`), npm included
- Python 3.15 (`.python-version`; used by node-gyp only)
- Npcap with WinPcap API-compatible mode enabled; raw 802.11 support is not needed
- Visual Studio Build Tools 2022 with Desktop development with C++, MSVC v143, Windows SDK, and ClangCL (required by the Node 26 addon build configuration)

## Install and run from source

Run PowerShell as Administrator for packet capture and native build setup. Use a path without spaces, for example `C:\dev\zqradar`.

```powershell
git clone --branch old-radar-dev --single-branch https://github.com/cleitonmarquesdecarvalho-ux/Albion-Online-ZQRadar.git C:\dev\zqradar
Set-Location C:\dev\zqradar
npm install
npm start
```

The first launch lists active IPv4 adapters and asks for a number. Pick the interface carrying the game connection. The default route interface is usually the right starting point; do not choose loopback (`127.0.0.1`). If traffic routes through a VPN, select that VPN interface instead. The selection is saved in ignored `ip.txt`; delete it to choose again.

Open [http://localhost:5001](http://localhost:5001). The HTTP and WebSocket services bind to `127.0.0.1` only.

Validate toolchain before installing packages with:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\check-env.ps1
```

`requirements.txt` is intentionally empty apart from comments: the project has no Python packages; Python is present for node-gyp.

## Authentication and protocol status

This source branch has no Discord OAuth/login implementation. The `/logout` route simply returns to the home page; there is no session middleware or auth configuration in this code. The README's Discord links are community links only.

The capture filter remains UDP port 5056. `scripts/classes/PhotonPacketParser.js` now decodes current Protocol18 traffic; live checks on this machine confirmed movement requests and resource/mob/player spawn events. Event handlers were updated only for fields supported by the live capture and the active Protocol18 reference. The player list on `/drawing` shows names, guild, alliance, faction, equipment and spells. Player locations are encrypted in passive movement traffic, so the app lists players without drawing misleading map dots. Map-background response handling is still awaiting a verified current JoinFinished/ChangeCluster response. Collect a current packet capture and compare decoded fields before changing other IDs or offsets.

## Build notes

See [FIXES.md](FIXES.md) for the exact dependency and native-build changes. The existing `build` command uses `nexe`; a single-file executable is not yet validated because native `cap`/Npcap binding and runtime resource loading need packaging-specific work.

## Credits

Original project by [Zeldruck](https://github.com/Zeldruck), based on [QRadar](https://github.com/FashionFlora/Albion-Online-Radar-QRadar).
