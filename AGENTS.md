# AGENTS.md

> Source of truth for ffmpegcut — context for AI coding agents. See `README.md` for user-facing docs.

---

## Project

- Tauri 2 + Solid + TS desktop app, macOS + Windows.
- Cuts video with bundled ffmpeg, stream copy by default (no re-encoding) with optional re-encode export.
- UI: `<video>` player + segments panel side-by-side, two-handle timeline (in/out) full-width below, topbar with Export/Reset/Cancel, empty state with "Add video" button.
- Non-goals: thumbnails, zoom, multi-track.
- Platforms: aarch64 macOS (Apple Silicon) for release builds; Windows buildable from source.

## Stack

- Tauri 2 (Rust) · Solid 1.9 + TS · @solidjs/router 0.16 · Vite 6 · bun · ffmpeg as Tauri sidecar.

## Repo layout

- `index.html`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `bun.lock` — root configs.
- `public/`, `src/` — Solid frontend. Entry: `src/index.tsx` → `App.tsx` (Router) → `pages/{Home,template}.tsx`. Components in `src/components/`, command wrappers in `src/lib/tauri.ts`, styles in `App.css`.
- `src-tauri/` — Rust backend. `src/{main,lib}.rs`, `video_server.rs`, `Cargo.toml`, `tauri.conf.json`, `capabilities/default.json`. Sidecar ffmpeg+ffprobe in `binaries/`.

## Commands

- `bun install` — install JS deps.
- `bun run tauri dev` — run app in dev.
- `bun run tauri build` — build release bundle.
- `bun run build` — frontend-only build → `dist/`.
- `cargo check` (in `src-tauri/`) — fast Rust type check.

## Architecture

- **Tauri commands** (in `src-tauri/src/lib.rs`): file pickers (`pick_video`, `pick_output_path`), metadata (`get_duration`, `get_frame_rate` via separate ffprobe calls, `get_keyframes` probes keyframe packet timestamps via ffprobe and caches per-path, `get_file_size` via `std::fs::metadata`), export (`cut_video` single-segment stream copy unused, `cut_video_segments` via concat demuxer with inpoint/outpoint; takes an `ExportOptions` struct — `mode` `"copy"` (default, stream copy) or `"encode"` (H.264/H.265, bitrate or CRF, optional `-r` fps and `-vf scale` resolution, audio re-encoded to AAC); streams `-progress pipe:1` and emits `"export-progress"` events (percentage of total segment duration) while running), video URL (`get_video_url` returns `http://localhost:{port}/?path={encoded}`), preview generation (`generate_preview` remuxes "difficult" formats like MKV/AVI/WMV into MP4/AAC via ffmpeg sidecar; cached; tracks in-flight remux; cancels previous on new request), preview cancel (`cancel_preview` kills in-flight remux & cleans up temp file), export cancel (`cancel_export` kills the in-flight export ffmpeg child and deletes the concat temp file + partial output; tracked via `ExportProcess` managed state `(CommandChild, concat_path, output_path)`).
- **Video serving**: embedded Axum HTTP server (`video_server.rs`) on `localhost:0` (random port). Handles byte-range `Range` headers for `<video>` seeking, maps file extensions to MIME types, runs as tokio background task. `get_video_url` command returns the local URL with percent-encoded path. CSP set to `null` (WKWebView requirement). Replaced the asset protocol (`convertFileSrc`) because of its 2 GB file limit.
- **Preview remuxing**: `generate_preview` command spawns ffmpeg sidecar with `-c:v copy -c:a aac -ac 2 -movflags +faststart -progress pipe:1`. Only runs for formats in `NEEDS_REMUX` list (mkv, avi, wmv, flv, ts, m2ts, mts). Directly playable formats (mp4, mov, webm, m4v) skip remux and pass through as-is. Managed state: `PreviewCache` (HashMap of original path → remuxed path), `PreviewProcess` (tracks in-flight ffmpeg child + output path). Previous remux is killed when a new one starts for a different file. Parses `out_time=` from ffmpeg stdout to emit `"preview-progress"` events (percentage `u8`) to the frontend. App-close cleanup: `on_window_event CloseRequested` drains `PreviewCache`, kills any in-flight preview process, and also kills any in-flight export ffmpeg child, removing its concat temp file + partial output.
- **Timeline** (`src/components/Timeline.tsx`): two-handle range slider, segments prop, `onChange`/`onSeek` callbacks, frame-rate snap when fps set, MM:SS:FF time format, exports `Segment { id, start, end }`. Optional `keyframes: number[]` + `snapToKeyframes: boolean` props: when enabled, `valueFromEvent` snaps the raw drag position to the nearest keyframe (applies to handles and the live seek playhead), falling back to frame snap when no keyframe data exists. Toggle lives in `Home.tsx` (`.ff-toggle`), default on, disabled when the file has no keyframe data.
- **Export settings panel**: gear button (`⚙`) next to Export in the topbar toggles an inline panel below it — Mode (Stream copy / Re-encode) and, when Re-encode, Codec (H.264/H.265), Bitrate (Auto-CRF / 4 / 8 / 16 Mbps), Frame rate (Source / 24 / 30 / 60), Resolution (Original / 2160p / 1440p / 1080p / 720p / 480p). Closing the panel resets all options to defaults (stream copy, H.264, auto, source fps, original). During any export a right-aligned progress line shows `Exporting…` (stream copy, which finishes near-instantly) or `Exporting… {pct}% · ~{time} left` (re-encode) with a `✕` cancel button (`cancel_export`); "Export complete"/"Export failed" status auto-dismisses after 4s.
- **Size estimates**: each segment row and a total line in the segments panel show estimated output size. Computed frontend-only in `Home.tsx` (`estimateBytes()` + `totalEstimate` memo) from source file size/duration + export options: stream copy ≈ source bitrate × duration; re-encode with fixed bitrate ≈ (video+audio bitrate)/8 × duration × 1.03; re-encode with CRF ≈ source bitrate scaled by resolution × fps (rough, content-dependent).
- **State**: local signals in `Home.tsx` (segments list, current selection, metadata); keep local until proven otherwise.
- **Window**: single `"main"` window, title `ffmpegcut`, 900x700 default, 840x620 min, CSP null.

## Conventions

- No code comments unless asked.
- Tauri commands live in `lib.rs`; keep `main.rs` minimal.
- CSS scoped per-component, fall back to `App.css` for globals.
- Check `bun.lock` / `Cargo.toml` before adding deps; run `bun install` / `cargo add` to update.
