import { createSignal, createResource, createMemo, For, onCleanup } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import {
  pickVideo,
  pickOutputPath,
  getDuration,
  getFileSize,
  getFrameRate,
  getKeyframes,
  getVideoUrl,
  generatePreview,
  cancelPreview,
  cancelExport,
  cutVideoSegments,
} from "../lib/tauri";
import Timeline, { type Segment } from "../components/Timeline";

function fileName(path: string): string {
  const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return path.slice(lastSep + 1);
}

function fileExt(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toUpperCase() : "";
}

function formatDuration(s: number, fps?: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const prefix = h > 0 ? `${h}:${m.toString().padStart(2, "0")}` : `${m}`;
  if (fps && fps > 0) {
    const frame = Math.round((s % 1) * fps);
    return `${prefix}:${sec.toString().padStart(2, "0")}:${frame.toString().padStart(2, "0")}`;
  }
  return `${prefix}:${sec.toString().padStart(2, "0")}`;
}

function deriveOutputName(input: string): string {
  const name = fileName(input);
  const dot = name.lastIndexOf(".");
  if (dot < 0) return `${name}_cut.mp4`;
  return `${name.slice(0, dot)}_cut${name.slice(dot)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [videoPath, setVideoPath] = createSignal<string | null>(null);
  const [duration, setDuration] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [videoWidth, setVideoWidth] = createSignal(0);
  const [videoHeight, setVideoHeight] = createSignal(0);
  const [selectedStart, setSelectedStart] = createSignal(0);
  const [selectedEnd, setSelectedEnd] = createSignal(0);
  const [exporting, setExporting] = createSignal(false);
  const [exportStatus, setExportStatus] = createSignal<{
    message: string;
    isError: boolean;
  } | null>(null);
  let exportStatusTimer: ReturnType<typeof setTimeout> | undefined;
  const [showExportOptions, setShowExportOptions] = createSignal(false);
  const DEFAULT_EXPORT_OPTIONS = {
    mode: "copy" as "copy" | "encode",
    codec: "h264" as "h264" | "h265",
    bitrate: "auto",
    crf: 18,
    frameRate: null as number | null,
    resolution: "original",
  };
  const [exportOptions, setExportOptions] = createSignal({
    ...DEFAULT_EXPORT_OPTIONS,
  });
  const [fileSize, setFileSize] = createSignal<number | null>(null);
  const [frameRate, setFrameRate] = createSignal(0);
  const [keyframes, setKeyframes] = createSignal<number[]>([]);
  const [keyframeSnap, setKeyframeSnap] = createSignal(true);
  const [showKeyframeTip, setShowKeyframeTip] = createSignal(true);
  const [segments, setSegments] = createSignal<Segment[]>([]);
  const [previewProgress, setPreviewProgress] = createSignal<number | null>(
    null,
  );
  const [videoLoading, setVideoLoading] = createSignal(false);
  const [exportProgress, setExportProgress] = createSignal<number | null>(null);
  const [exportRemaining, setExportRemaining] = createSignal<number | null>(
    null,
  );
  let exportStart = 0;
  let cancelRequested = false;

  // const [videoUrl] = createResource(videoPath, (path) => getVideoUrl(path));
  const [previewPath] = createResource(videoPath, (path) =>
    generatePreview(path),
  );
  const [videoUrl] = createResource(previewPath, (path) => getVideoUrl(path));

  // Listen for preview progress events from the backend.
  const unlisten = listen<number>("preview-progress", (event) => {
    setPreviewProgress(event.payload);
  });
  const unlistenExport = listen<number>("export-progress", (event) => {
    const pct = event.payload;
    setExportProgress(pct);
    const elapsed = (Date.now() - exportStart) / 1000;
    if (pct > 0) {
      setExportRemaining((elapsed * (100 - pct)) / pct);
    }
  });
  onCleanup(() => {
    clearTimeout(exportStatusTimer);
    const fns = Promise.all([unlisten, unlistenExport]);
    return fns.then(([fn1, fn2]) => {
      fn1();
      fn2();
    });
  });

  let videoRef: HTMLVideoElement | undefined;
  let idCounter = 0;

  const handleOpenVideo = async () => {
    setPreviewProgress(null);
    const path = await pickVideo();
    if (!path) return;
    try {
      const dur = await getDuration(path);
      const size = await getFileSize(path);
      const fps = await getFrameRate(path);
      const kf = await getKeyframes(path).catch(() => []);
      setVideoPath(path);
      setDuration(dur);
      setSelectedEnd(dur);
      setFileSize(size);
      setFrameRate(fps);
      setKeyframes(kf);
      setCurrentTime(0);
    } catch (e) {
      alert(`Could not open video: ${e}`);
    }
  };

  const handleReset = () => {
    setSelectedStart(0);
    setSelectedEnd(duration());
    setSegments([]);
  };

  const handleCancel = async () => {
    await cancelPreview().catch(() => {});
    setVideoPath(null);
    setDuration(0);
    setCurrentTime(0);
    setVideoWidth(0);
    setVideoHeight(0);
    setSelectedStart(0);
    setSelectedEnd(0);
    setFileSize(null);
    setFrameRate(0);
    setKeyframes([]);
    setSegments([]);
    setPreviewProgress(null);
  };

  const handleExport = async () => {
    const input = videoPath();
    if (!input) return;

    const segs = segments();
    if (segs.length === 0) return;

    const output = await pickOutputPath(deriveOutputName(input));
    if (!output) return;

    setExporting(true);
    setExportStatus(null);
    setExportProgress(null);
    setExportRemaining(null);
    cancelRequested = false;
    exportStart = Date.now();
    try {
      const pairs: [number, number][] = segs.map((s) => [s.start, s.end]);
      await cutVideoSegments(input, output, pairs, exportOptions());
      if (!cancelRequested) showExportStatus("Export complete");
    } catch (e) {
      if (!cancelRequested) showExportStatus(`Export failed: ${e}`, true);
    } finally {
      setExporting(false);
      setExportProgress(null);
      setExportRemaining(null);
    }
  };

  const showExportStatus = (message: string, isError = false) => {
    clearTimeout(exportStatusTimer);
    setExportStatus({ message, isError });
    exportStatusTimer = setTimeout(() => setExportStatus(null), 4000);
  };

  const canExport = () => segments().length > 0;
  const canAddSegment = () => videoPath() && selectedStart() < selectedEnd();

  const addSegment = () => {
    if (!canAddSegment()) return;
    const id = String(++idCounter);
    setSegments((prev) =>
      [...prev, { id, start: selectedStart(), end: selectedEnd() }].sort(
        (a, b) => a.start - b.start,
      ),
    );
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const estimateBytes = (start: number, end: number): number | null => {
    const fs = fileSize();
    const dur = duration();
    if (fs == null || dur <= 0) return null;
    const totalDur = Math.max(0, end - start);
    if (totalDur <= 0) return 0;

    const opts = exportOptions();
    if (opts.mode === "copy") {
      return (fs / dur) * totalDur;
    }

    if (opts.bitrate !== "auto") {
      const vbps = (parseInt(opts.bitrate) || 0) * 1000;
      const abps = 192000;
      return Math.round(((vbps + abps) / 8) * totalDur * 1.03);
    }

    let scaleFactor = 1;
    if (opts.resolution !== "original") {
      const srcH = videoHeight();
      const targetH = parseInt(opts.resolution) || srcH;
      if (srcH > 0) {
        const eff = Math.min(targetH, srcH);
        scaleFactor = (eff * eff) / (srcH * srcH);
      }
    }
    let fpsFactor = 1;
    const srcFps = frameRate();
    if (opts.frameRate && opts.frameRate > 0 && srcFps > 0) {
      fpsFactor = opts.frameRate / srcFps;
    }
    return Math.round((fs / dur) * totalDur * scaleFactor * fpsFactor);
  };

  const totalEstimate = createMemo(() => {
    const segs = segments();
    if (segs.length === 0) return null;
    let total = 0;
    for (const seg of segs) {
      const e = estimateBytes(seg.start, seg.end);
      if (e == null) return null;
      total += e;
    }
    return total;
  });

  return (
    <main class="app ff-stack" style={{ "--ff-stack-gap": "0" }}>
      <div class="ff-topbar">
        <div class="ff-topbar__start">
          <button
            class="ff-btn ff-btn--secondary"
            onClick={handleCancel}
            disabled={!videoPath() || exporting()}
          >
            Cancel
          </button>
        </div>
        <div class="ff-topbar__end">
          <button
            class="ff-btn ff-btn--secondary"
            onClick={() =>
              setShowExportOptions((v) => {
                const next = !v;
                if (!next) setExportOptions({ ...DEFAULT_EXPORT_OPTIONS });
                return next;
              })
            }
            disabled={exporting()}
            title="Export options"
            style={{ "font-size": "18px" }}
          >
            ⚙
          </button>
          <button
            class="ff-btn ff-btn--primary"
            onClick={handleExport}
            disabled={!canExport() || exporting()}
          >
            {exporting() ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
      {showExportOptions() && (
        <div class="ff-export-options">
          <label class="ff-export-options__field">
            <span class="ff-text--tertiary ff-mono">Mode</span>
            <select
              class="ff-select"
              value={exportOptions().mode}
              onChange={(e) =>
                setExportOptions((o) => ({
                  ...o,
                  mode: e.currentTarget.value as "copy" | "encode",
                }))
              }
            >
              <option value="copy">Stream copy (lossless)</option>
              <option value="encode">Re-encode</option>
            </select>
          </label>
          {exportOptions().mode === "encode" && (
            <>
              <label class="ff-export-options__field">
                <span class="ff-text--tertiary ff-mono">Codec</span>
                <select
                  class="ff-select"
                  value={exportOptions().codec}
                  onChange={(e) =>
                    setExportOptions((o) => ({
                      ...o,
                      codec: e.currentTarget.value as "h264" | "h265",
                    }))
                  }
                >
                  <option value="h264">H.264</option>
                  <option value="h265">H.265</option>
                </select>
              </label>
              <label class="ff-export-options__field">
                <span class="ff-text--tertiary ff-mono">Bitrate</span>
                <select
                  class="ff-select"
                  value={exportOptions().bitrate}
                  onChange={(e) =>
                    setExportOptions((o) => ({
                      ...o,
                      bitrate: e.currentTarget.value,
                    }))
                  }
                >
                  <option value="auto">Auto (CRF)</option>
                  <option value="4000k">4 Mbps</option>
                  <option value="8000k">8 Mbps</option>
                  <option value="16000k">16 Mbps</option>
                </select>
              </label>
              <label class="ff-export-options__field">
                <span class="ff-text--tertiary ff-mono">Frame rate</span>
                <select
                  class="ff-select"
                  value={exportOptions().frameRate ?? "source"}
                  onChange={(e) =>
                    setExportOptions((o) => ({
                      ...o,
                      frameRate:
                        e.currentTarget.value === "source"
                          ? null
                          : Number(e.currentTarget.value),
                    }))
                  }
                >
                  <option value="source">Source</option>
                  <option value="24">24 fps</option>
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                </select>
              </label>
              <label class="ff-export-options__field">
                <span class="ff-text--tertiary ff-mono">Resolution</span>
                <select
                  class="ff-select"
                  value={exportOptions().resolution}
                  onChange={(e) =>
                    setExportOptions((o) => ({
                      ...o,
                      resolution: e.currentTarget.value,
                    }))
                  }
                >
                  <option value="original">Original</option>
                  <option value="2160p">2160p</option>
                  <option value="1440p">1440p</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </label>
            </>
          )}
        </div>
      )}
      {exportStatus() && (
        <div
          class="ff-status"
          classList={{ "ff-status--error": exportStatus()!.isError }}
        >
          {exportStatus()!.message}
        </div>
      )}
      {exporting() && (
        <div class="ff-export-progress">
          <span>
            {exportProgress() != null
              ? exportRemaining() != null
                ? `Exporting… ${exportProgress()}% · ~${formatClock(exportRemaining()!)} left`
                : `Exporting… ${exportProgress()}%`
              : "Exporting…"}
          </span>
          <button
            class="ff-btn ff-btn--secondary ff-btn--sm ff-btn--icon"
            onClick={() => {
              cancelRequested = true;
              cancelExport().catch(() => {});
              showExportStatus("Export cancelled");
            }}
            title="Cancel export"
          >
            ✕
          </button>
        </div>
      )}

      <div
        class="ff-row"
        style={{
          "align-items": "flex-start",
          "--ff-row-gap": "var(--ff-space-3)",
          padding: "var(--ff-space-3) var(--ff-space-4) 0",
        }}
      >
        <div style={{ flex: "1 1 auto", "min-width": 0 }}>
          <div class="ff-preview" style={{ position: "relative" }}>
            <div style={{ position: "relative" }}>
              {videoPath() ? (
                previewPath.loading ? (
                  <div class="ff-preview__placeholder">
                    <span class="ff-text--secondary">
                      {previewProgress() != null
                        ? `Preparing preview… ${previewProgress()}%`
                        : "Preparing preview…"}
                    </span>
                  </div>
                ) : previewPath.error ? (
                  <div class="ff-preview__placeholder">
                    <span class="ff-text--secondary">
                      Couldn't preview this file: {String(previewPath.error)}
                    </span>
                  </div>
                ) : (
                  <video
                    ref={videoRef!}
                    class="ff-preview__video"
                    src={videoUrl()}
                    controls
                    onLoadStart={() => setVideoLoading(true)}
                    onCanPlay={() => setVideoLoading(false)}
                    onError={() => setVideoLoading(false)}
                    onLoadedMetadata={() => {
                      const v = videoRef!;
                      if (!v) return;
                      setVideoWidth(v.videoWidth);
                      setVideoHeight(v.videoHeight);
                    }}
                    onTimeUpdate={() => {
                      const v = videoRef!;
                      if (!v) return;
                      setCurrentTime(v.currentTime);
                    }}
                  />
                )
              ) : (
                <div class="ff-preview__placeholder">
                  <button
                    class="ff-btn ff-btn--primary ff-btn--lg"
                    onClick={handleOpenVideo}
                  >
                    Add video
                  </button>
                </div>
              )}
              {videoLoading() && (
                <div class="ff-preview__overlay">
                  <span class="ff-text--secondary ff-mono">Loading…</span>
                </div>
              )}
            </div>
            <div class="ff-preview__caption">
              <div
                class="ff-row"
                style={{
                  "align-items": "baseline",
                  "--ff-row-gap": "var(--ff-space-2)",
                  "flex-wrap": "wrap",
                  "font-size": "var(--ff-text-caption)",
                }}
              >
                <span>{videoPath() ? fileName(videoPath()!) : "—"}</span>
                <span class="ff-text--tertiary">·</span>
                <span class="ff-text--secondary">
                  {videoPath() ? fileExt(videoPath()!) : "—"}
                </span>
                <span class="ff-text--tertiary">·</span>
                <span class="ff-text--secondary ff-mono">
                  {videoPath()
                    ? formatDuration(duration(), frameRate())
                    : "00:00"}
                </span>
                <span class="ff-text--tertiary">·</span>
                <span class="ff-text--secondary">
                  {videoPath() && videoWidth() > 0 && videoHeight() > 0
                    ? `${videoWidth()}×${videoHeight()}`
                    : "—"}
                </span>
                <span class="ff-text--tertiary">·</span>
                <span class="ff-text--secondary">
                  {videoPath() && fileSize() != null
                    ? formatFileSize(fileSize()!)
                    : "—"}
                </span>
                <span class="ff-text--tertiary">·</span>
                <span class="ff-text--secondary">
                  {videoPath() && frameRate() > 0
                    ? `${frameRate().toFixed(2)} fps`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          class="ff-stack"
          style={{
            flex: "0 0 280px",
            "--ff-stack-gap": "var(--ff-space-1)",
            "padding-top": "var(--ff-space-1)",
          }}
        >
          <div class="ff-segment-container">
            <For each={segments()}>
              {(seg) => {
                const est = estimateBytes(seg.start, seg.end);
                return (
                  <div class="ff-segment">
                    <span class="ff-segment__time ff-mono">
                      {formatDuration(seg.start, frameRate())} —{" "}
                      {formatDuration(seg.end, frameRate())}
                    </span>
                    {est != null && (
                      <span class="ff-segment__size ff-mono">
                        ~{formatFileSize(est)}
                      </span>
                    )}
                    <button
                      class="ff-btn ff-btn--tertiary ff-btn--sm ff-btn--icon"
                      onClick={() => removeSegment(seg.id)}
                      disabled={exporting()}
                    >
                      ✕
                    </button>
                  </div>
                );
              }}
            </For>
          </div>
          {segments().length > 0 ? (
            <span class="ff-text--secondary ff-mono">
              {totalEstimate() != null
                ? `Total: ~${formatFileSize(totalEstimate()!)}`
                : "Total: —"}
            </span>
          ) : (
            <span class="ff-text--secondary ff-mono">
              Drag the timeline handles to set a range, then click "+ Add
              segment" below the timeline
            </span>
          )}
        </div>
      </div>

      <div
        class="ff-stack"
        style={{
          padding: "var(--ff-space-4) var(--ff-space-4)",
          "--ff-stack-gap": "var(--ff-space-2)",
        }}
      >
        <div
          class="ff-row"
          style={{
            "align-items": "center",
            "justify-content": "space-between",
            gap: "var(--ff-space-2)",
          }}
        >
          <label class="ff-toggle">
            <input
              type="checkbox"
              checked={keyframeSnap()}
              onChange={(e) => setKeyframeSnap(e.currentTarget.checked)}
              disabled={!videoPath() || exporting() || keyframes().length === 0}
            />
            <span class="ff-toggle__track" />
            <span class="ff-text--secondary ff-mono">Snap to keyframes</span>
          </label>
          {keyframes().length === 0 && videoPath() && (
            <span class="ff-text--tertiary" style={{ "font-size": "11px" }}>
              no keyframe data for this file
            </span>
          )}
          <div class="ff-segment" style={{ margin: 0 }}>
            <button
              class="ff-btn ff-btn--tertiary ff-btn--sm"
              onClick={handleReset}
              disabled={!videoPath() || exporting()}
            >
              Reset
            </button>
          </div>
        </div>
        {videoPath() && showKeyframeTip() && (
          <div class="ff-keyframe-tip">
            <span class="ff-text--tertiary ff-mono">
              Keyframes can be several seconds apart on some videos, so snapping
              only allows cuts at those points — turn it off for finer control.
            </span>
            <button
              class="ff-btn ff-btn--tertiary ff-btn--sm ff-btn--icon"
              onClick={() => setShowKeyframeTip(false)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        <Timeline
          duration={duration()}
          start={selectedStart()}
          end={selectedEnd()}
          currentTime={currentTime()}
          frameRate={frameRate()}
          keyframes={keyframes()}
          snapToKeyframes={keyframeSnap()}
          segments={segments()}
          onChange={(start, end) => {
            setSelectedStart(start);
            setSelectedEnd(end);
          }}
          onSeek={(time) => {
            if (videoRef) videoRef.currentTime = time;
          }}
          disabled={!videoPath() || duration() === 0}
        />
        <div class="ff-row" style={{ "justify-content": "center" }}>
          <div class="ff-segment" style={{ margin: 0 }}>
            <button
              class="ff-btn ff-btn--tertiary ff-btn--sm"
              onClick={addSegment}
              disabled={!canAddSegment() || exporting()}
            >
              + Add segment
            </button>
          </div>
        </div>
      </div>
      <span class="ff-text--secondary ff-mono">
        Some formats are converted for preview; these temporary files are deleted automatically when the app closes
      </span>
    </main>
  );
}
