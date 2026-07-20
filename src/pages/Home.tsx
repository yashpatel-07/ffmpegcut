import { createSignal, For } from "solid-js";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  pickVideo,
  pickOutputPath,
  getDuration,
  getFileSize,
  getFrameRate,
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
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (fps && fps > 0) {
    const frame = Math.round((s % 1) * fps);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}:${frame.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
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

export default function Home() {
  const [videoPath, setVideoPath] = createSignal<string | null>(null);
  const [duration, setDuration] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [videoWidth, setVideoWidth] = createSignal(0);
  const [videoHeight, setVideoHeight] = createSignal(0);
  const [selectedStart, setSelectedStart] = createSignal(0);
  const [selectedEnd, setSelectedEnd] = createSignal(0);
  const [exporting, setExporting] = createSignal(false);
  const [fileSize, setFileSize] = createSignal<number | null>(null);
  const [frameRate, setFrameRate] = createSignal(0);
  const [segments, setSegments] = createSignal<Segment[]>([]);

  let videoRef: HTMLVideoElement | undefined;
  let idCounter = 0;

  const handleOpenVideo = async () => {
    const path = await pickVideo();
    if (!path) return;
    try {
      const dur = await getDuration(path);
      const size = await getFileSize(path);
      const fps = await getFrameRate(path);
      setVideoPath(path);
      setDuration(dur);
      setSelectedEnd(dur);
      setFileSize(size);
      setFrameRate(fps);
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

  const handleCancel = () => {
    setVideoPath(null);
    setDuration(0);
    setCurrentTime(0);
    setVideoWidth(0);
    setVideoHeight(0);
    setSelectedStart(0);
    setSelectedEnd(0);
    setFileSize(null);
    setFrameRate(0);
    setSegments([]);
  };

  const handleExport = async () => {
    const input = videoPath();
    if (!input) return;

    const segs = segments();
    if (segs.length === 0) return;

    const output = await pickOutputPath(deriveOutputName(input));
    if (!output) return;

    setExporting(true);
    try {
      const pairs: [number, number][] = segs.map((s) => [s.start, s.end]);
      await cutVideoSegments(input, output, pairs);
    } catch (e) {
      alert(`Export failed: ${e}`);
    } finally {
      setExporting(false);
    }
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
          <button
            class="ff-btn ff-btn--secondary"
            onClick={handleReset}
            disabled={!videoPath() || exporting()}
          >
            Reset
          </button>
        </div>
        <div class="ff-topbar__end">
          <button
            class="ff-btn ff-btn--primary"
            onClick={handleExport}
            disabled={!canExport() || exporting()}
          >
            {exporting() ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

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
            {videoPath() ? (
              <video
                ref={videoRef!}
                class="ff-preview__video"
                src={convertFileSrc(videoPath()!)}
                controls
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
              {(seg) => (
                <div class="ff-segment">
                  <span class="ff-segment__time ff-mono">
                    {formatDuration(seg.start, frameRate())} —{" "}
                    {formatDuration(seg.end, frameRate())}
                  </span>
                  <button
                    class="ff-btn ff-btn--tertiary ff-btn--sm ff-btn--icon"
                    onClick={() => removeSegment(seg.id)}
                    disabled={exporting()}
                  >
                    ✕
                  </button>
                </div>
              )}
            </For>
          </div>
          <div class="ff-segment">
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

      <div
        class="ff-stack"
        style={{
          padding: "var(--ff-space-3) var(--ff-space-4)",
          "--ff-stack-gap": "var(--ff-space-2)",
        }}
      >
        <Timeline
          duration={duration()}
          start={selectedStart()}
          end={selectedEnd()}
          currentTime={currentTime()}
          frameRate={frameRate()}
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
      </div>

      {exporting() && (
        <div class="ff-progress ff-progress--indeterminate">
          <div class="ff-progress__fill" />
        </div>
      )}
    </main>
  );
}
