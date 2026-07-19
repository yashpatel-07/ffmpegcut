# ffmpegcut

A small cross-platform desktop app for cutting video clips fast. Powered by Tauri, Solid, and a bundled `ffmpeg` doing stream-copy cuts — no re-encoding.

## Preview

<!-- TODO: drop a screenshot of the empty state here -->
<!-- TODO: drop a screenshot of the timeline + segments UI here -->
<!-- TODO: drop a screenshot of an export in progress / completed -->

## Features

- Two-handle timeline to pick an in / out point, with frame-accurate snapping
- Multiple cuts in one pass — add as many segments as you want, export once
- Native open and save dialogs
- Stream-copy output (no quality loss, very fast)
- Single binary app on macOS and Windows

## Requirements

To develop or build from source you need:

- **Node.js** + **bun** (package manager / script runner)
- **Rust** toolchain (stable) and the platform deps for [Tauri 2](https://tauri.app/start/prerequisites/)
- **macOS**: Xcode Command Line Tools
- **Windows**: Microsoft C++ Build Tools + WebView2 (already shipped on Windows 10/11)

`ffmpeg` and `ffprobe` are bundled as Tauri sidecar binaries under `src-tauri/binaries/` — you do not need to install them yourself.

## Run in development

```sh
bun install
bun run tauri dev
```

This starts Vite, launches the Tauri shell, and opens the app window with hot reload.

## Build a release bundle

### macOS (automated)

1. Encode the four sidecar binaries as base64 and add them as repository secrets (Settings → Secrets and variables → Actions):
   - `FFMPEG_MACOS_AARCH64_B64` — `ffmpeg-aarch64-apple-darwin`
   - `FFPROBE_MACOS_AARCH64_B64` — `ffprobe-aarch64-apple-darwin`
   - `FFMPEG_MACOS_X86_64_B64` — `ffmpeg-x86_64-apple-darwin`
   - `FFPROBE_MACOS_X86_64_B64` — `ffprobe-x86_64-apple-darwin`
   Encode locally with `base64 -i <file> | pbcopy`.
2. Open the Actions tab → "release" workflow → "Run workflow".
3. Enter a tag (default `v0.1.0`) and click run.
4. The workflow builds a **universal** `.dmg` (Apple Silicon + Intel) and attaches it to a new GitHub Release.

Note: the app is unsigned. macOS will warn on first open — right-click → Open.

### Locally

```sh
bun run tauri build
```

Bundles land under `src-tauri/target/release/bundle/`. For a universal macOS build, add `--target universal-apple-darwin`.

For a frontend-only build (no native shell):

```sh
bun run build
```

### Windows

Not wired up in CI yet. To produce a Windows installer yourself:

1. Download `ffmpeg` and `ffprobe` Windows builds (e.g. from [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) — pick `win64-gpl`).
2. Extract the two `.exe` files from the zip.
3. Rename and place them in `src-tauri/binaries/`:
   - `ffmpeg-x86_64-pc-windows-msvc.exe`
   - `ffprobe-x86_64-pc-windows-msvc.exe`
4. On Windows, run `bun run tauri build`. Installers land in `src-tauri/target/release/bundle/`.

Note: the app is unsigned. Windows SmartScreen will warn on first launch.

## How it works

1. Pick a video with the native file dialog.
2. Drag the two timeline handles to set a range. Click **Add segment** to commit it; repeat for as many cuts as you want.
3. Click **Export**, choose where to save, and `ffmpegcut` runs `ffmpeg` once with the `concat` demuxer — every segment is stitched in a single stream-copy pass.

## Tech stack

![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=white)
![Solid](https://img.shields.io/badge/Solid-1.9-2C4F7C?logo=solid&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000?logo=rust&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?logo=ffmpeg&logoColor=white)

- [Tauri 2](https://tauri.app/) (Rust) — desktop shell, sidecar process
- [Solid 1.9](https://www.solidjs.com/) + TypeScript — reactive UI
- [Vite 6](https://vitejs.dev/) — dev server / bundler
- [bun](https://bun.sh/) — package manager
- [ffmpeg](https://ffmpeg.org/) / [ffprobe](https://ffmpeg.org/ffprobe.html) — bundled, used in stream-copy mode

## License

Proprietary — all rights reserved. See [LICENSE](./LICENSE).

## Credits

This project is not affiliated with the FFmpeg project. It bundles unmodified `ffmpeg` and `ffprobe` binaries, which are licensed under [LGPL/GPL](https://www.ffmpeg.org/legal.html) depending on the build. FFmpeg is a trademark of its respective owners; please see [ffmpeg.org](https://ffmpeg.org/) for upstream source, license texts, and attribution.
