export default function Home() {
  return (
    <main class="app ff-stack" style={{ "--ff-stack-gap": "0" }}>
      <div
        class="ff-stack"
        style={{
          padding: "var(--ff-space-3) var(--ff-space-4) 0",
          "--ff-stack-gap": "0",
        }}
      >
        <div class="ff-preview">
          <div
            class="ff-preview__video"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              color: "var(--ff-text-tertiary)",
              "font-size": "var(--ff-text-body)",
            }}
          >
            No video loaded
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
              <span>filename.mp4</span>
              <span class="ff-text--tertiary">·</span>
              <span class="ff-text--secondary">MP4</span>
              <span class="ff-text--tertiary">·</span>
              <span class="ff-text--secondary ff-mono">01:42</span>
              <span class="ff-text--tertiary">·</span>
              <span class="ff-text--secondary">1920×1080</span>
              <span class="ff-text--tertiary">·</span>
              <span class="ff-text--secondary">12.4 MB</span>
            </div>
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
        <div
          class="ff-timeline"
          style={{ "--range-start": "0", "--range-end": "1" }}
        >
          <div class="ff-timeline__track" />
          <div class="ff-timeline__range" />
          <div class="ff-timeline__handle ff-timeline__handle--start" />
          <div class="ff-timeline__handle ff-timeline__handle--end" />
        </div>
        <div class="ff-row" style={{ "justify-content": "space-between" }}>
          <span class="ff-timeline__time">00:00</span>
          <span class="ff-timeline__time">00:00 — 01:00</span>
          <span class="ff-timeline__time">01:00</span>
        </div>
      </div>

      <div class="ff-actionbar">
        <div class="ff-actionbar__start">
          <button class="ff-btn ff-btn--primary">Export</button>
        </div>
        <div class="ff-actionbar__end">
          <a class="ff-btn ff-btn--tertiary ff-btn--sm" href="/template">
            Template
          </a>
          <button class="ff-btn ff-btn--secondary">Cancel</button>
        </div>
      </div>
    </main>
  );
}
