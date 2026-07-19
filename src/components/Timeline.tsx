import { createSignal, createMemo, For } from "solid-js";

export interface Segment {
  id: string;
  start: number;
  end: number;
}

interface TimelineProps {
  duration: number;
  start: number;
  end: number;
  currentTime: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
  frameRate?: number;
  onSeek?: (time: number) => void;
  segments?: Segment[];
}

function formatTime(s: number, fps?: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (fps && fps > 0) {
    const frame = Math.round((s % 1) * fps);
    return `${m}:${sec.toString().padStart(2, "0")}:${frame.toString().padStart(2, "0")}`;
  }
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function Timeline(props: TimelineProps) {
  let trackRef!: HTMLDivElement;
  const [dragHandle, setDragHandle] = createSignal<"start" | "end" | null>(
    null,
  );
  const [dragValue, setDragValue] = createSignal(0);

  const displayStart = createMemo(() =>
    props.disabled
      ? 0
      : dragHandle() === "start"
        ? dragValue()
        : props.start,
  );
  const displayEnd = createMemo(() =>
    props.disabled
      ? 0
      : dragHandle() === "end"
        ? dragValue()
        : props.end,
  );
  const rangeStart = createMemo(() =>
    props.disabled || props.duration === 0
      ? 0
      : displayStart() / props.duration,
  );
  const rangeEnd = createMemo(() =>
    props.disabled || props.duration === 0
      ? 0
      : displayEnd() / props.duration,
  );
  const playheadPercent = createMemo(() =>
    props.disabled || props.duration === 0
      ? null
      : (props.currentTime / props.duration) * 100,
  );

  const valueFromEvent = (e: PointerEvent): number => {
    const rect = trackRef.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const value = ratio * props.duration;
    if (props.frameRate && props.frameRate > 0) {
      return Math.round(value * props.frameRate) / props.frameRate;
    }
    return Math.round(value * 100) / 100;
  };

  const onPointerDown = (handle: "start" | "end") => (e: PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setDragHandle(handle);
    setDragValue(valueFromEvent(e));

    const onMove = (e: PointerEvent) => {
      const raw = valueFromEvent(e);
      if (dragHandle() === "start") {
        setDragValue(Math.min(raw, props.end));
      } else {
        setDragValue(Math.max(raw, props.start));
      }
      props.onSeek?.(raw);
    };

    const onUp = (e: PointerEvent) => {
      const raw = valueFromEvent(e);
      const currentHandle = dragHandle();
      setDragHandle(null);

      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);

      if (currentHandle === "start") {
        const clamped = Math.max(0, Math.min(raw, props.end));
        if (clamped !== props.start) props.onChange(clamped, props.end);
      } else if (currentHandle === "end") {
        const clamped = Math.min(props.duration, Math.max(raw, props.start));
        if (clamped !== props.end) props.onChange(props.start, clamped);
      }
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  return (
    <>
      <div
        class="ff-timeline"
        classList={{ "ff-timeline--disabled": props.disabled }}
        ref={trackRef}
        style={{
          "--range-start": String(rangeStart()),
          "--range-end": String(rangeEnd()),
        }}
      >
        <div class="ff-timeline__track" />
        {!props.disabled && props.segments && (
          <For each={props.segments}>
            {(seg) => (
              <div
                class="ff-timeline__range"
                style={{
                  left: `${(seg.start / props.duration) * 100}%`,
                  right: `${(1 - seg.end / props.duration) * 100}%`,
                }}
              />
            )}
          </For>
        )}
        {!props.disabled && <div class="ff-timeline__range" />}
        <div
          class="ff-timeline__handle ff-timeline__handle--start"
          role="slider"
          aria-label="Start handle"
          aria-valuemin={0}
          aria-valuemax={props.duration}
          aria-valuenow={displayStart()}
          style={
            dragHandle() === "start"
              ? { transform: "translateX(-50%) scaleX(1.3)" }
              : undefined
          }
          onPointerDown={onPointerDown("start")}
        />
        <div
          class="ff-timeline__handle ff-timeline__handle--end"
          role="slider"
          aria-label="End handle"
          aria-valuemin={0}
          aria-valuemax={props.duration}
          aria-valuenow={displayEnd()}
          style={
            dragHandle() === "end"
              ? { transform: "translateX(-50%) scaleX(1.3)" }
              : undefined
          }
          onPointerDown={onPointerDown("end")}
        />
        {playheadPercent() != null && (
          <div
            class="ff-timeline__playhead"
            style={{ left: `${playheadPercent()!}%` }}
          />
        )}
      </div>
      <div class="ff-row" style={{ "justify-content": "space-between" }}>
        <span class="ff-timeline__time">00:00</span>
        <span class="ff-timeline__time">
          {formatTime(displayStart(), props.frameRate)} — {formatTime(displayEnd(), props.frameRate)}
        </span>
        <span class="ff-timeline__time">{formatTime(props.duration, props.frameRate)}</span>
        {props.frameRate && props.frameRate > 0 && (
          <span
            class="ff-timeline__time"
            style={{ opacity: 0.4, "font-size": "9px", "align-self": "center" }}
          >
            MM:SS:FF
          </span>
        )}
      </div>
    </>
  );
}
