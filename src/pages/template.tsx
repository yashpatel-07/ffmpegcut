export default function Template() {
  return (
    <main class="app ff-stack" style={{ padding: "var(--ff-space-4)", "--ff-stack-gap": "var(--ff-space-6)" }}>
      <a class="ff-btn ff-btn--tertiary ff-btn--sm" href="/">&larr; Home</a>

      <Section title="Buttons">
        <div class="ff-stack" style={{ "--ff-stack-gap": "var(--ff-space-2)" }}>
          <Row label="md">
            <button class="ff-btn ff-btn--primary ff-btn--md">Primary</button>
            <button class="ff-btn ff-btn--secondary ff-btn--md">Secondary</button>
            <button class="ff-btn ff-btn--tertiary ff-btn--md">Tertiary</button>
            <button class="ff-btn ff-btn--primary ff-btn--md" disabled>Disabled</button>
            <button class="ff-btn ff-btn--md ff-btn--icon" aria-label="Icon">
              <span aria-hidden="true">★</span>
            </button>
          </Row>
          <Row label="sm">
            <button class="ff-btn ff-btn--primary ff-btn--sm">Primary</button>
            <button class="ff-btn ff-btn--secondary ff-btn--sm">Secondary</button>
            <button class="ff-btn ff-btn--tertiary ff-btn--sm">Tertiary</button>
            <button class="ff-btn ff-btn--primary ff-btn--sm" disabled>Disabled</button>
            <button class="ff-btn ff-btn--sm ff-btn--icon" aria-label="Icon">
              <span aria-hidden="true">★</span>
            </button>
          </Row>
          <Row label="lg">
            <button class="ff-btn ff-btn--primary ff-btn--lg">Primary</button>
            <button class="ff-btn ff-btn--secondary ff-btn--lg">Secondary</button>
            <button class="ff-btn ff-btn--tertiary ff-btn--lg">Tertiary</button>
            <button class="ff-btn ff-btn--primary ff-btn--lg" disabled>Disabled</button>
            <button class="ff-btn ff-btn--lg ff-btn--icon" aria-label="Icon">
              <span aria-hidden="true">★</span>
            </button>
          </Row>
          <div class="ff-btn-group">
            <button class="ff-btn ff-btn--secondary">Cancel</button>
            <button class="ff-btn ff-btn--primary">Confirm</button>
          </div>
        </div>
      </Section>

      <Section title="Progress">
        <div class="ff-stack" style={{ "--ff-stack-gap": "var(--ff-space-3)" }}>
          <div>
            <Label>determinate · 42%</Label>
            <div class="ff-progress" style={{ "--progress": "0.42" }}>
              <div class="ff-progress__fill" />
            </div>
          </div>
          <div>
            <Label>lg · 80%</Label>
            <div class="ff-progress ff-progress--lg" style={{ "--progress": "0.8" }}>
              <div class="ff-progress__fill" />
            </div>
          </div>
          <div>
            <Label>indeterminate</Label>
            <div class="ff-progress ff-progress--indeterminate">
              <div class="ff-progress__fill" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Preview">
        <div class="ff-preview" style={{ "max-width": "480px" }}>
          <div
            class="ff-preview__video"
            style={{ display: "flex", "align-items": "center", "justify-content": "center", color: "var(--ff-text-tertiary)" }}
          >
            16:9 preview
          </div>
          <div class="ff-preview__caption">caption · filename.mp4</div>
        </div>
      </Section>

      <Section title="Top bar">
        <div class="ff-topbar" style={{ "border-radius": "var(--ff-radius-md)", border: "1px solid var(--ff-border)" }}>
          <div class="ff-topbar__start">
            <button class="ff-btn ff-btn--primary">Export</button>
          </div>
          <div class="ff-topbar__end">
            <button class="ff-btn ff-btn--secondary">Cancel</button>
          </div>
        </div>
      </Section>

      <Section title="Timeline">
        <div class="ff-stack" style={{ "--ff-stack-gap": "var(--ff-space-2)" }}>
          <div
            class="ff-timeline"
            style={{ "--range-start": "0.2", "--range-end": "0.7" }}
          >
            <div class="ff-timeline__track" />
            <div class="ff-timeline__range" />
            <div class="ff-timeline__handle ff-timeline__handle--start" />
            <div class="ff-timeline__handle ff-timeline__handle--end" />
          </div>
          <div class="ff-row" style={{ "justify-content": "space-between" }}>
            <span class="ff-timeline__time">00:00</span>
            <span class="ff-timeline__time">00:42</span>
            <span class="ff-timeline__time">01:00</span>
          </div>
        </div>
      </Section>

      <Section title="Type ramp">
        <div class="ff-stack" style={{ "--ff-stack-gap": "var(--ff-space-1)" }}>
          <p style={{ "font-size": "var(--ff-text-headline)" }}>Headline · 16px</p>
          <p style={{ "font-size": "var(--ff-text-callout)" }}>Callout · 14px</p>
          <p style={{ "font-size": "var(--ff-text-body)" }}>Body · 13px</p>
          <p style={{ "font-size": "var(--ff-text-caption)" }}>Caption · 11px</p>
          <p class="ff-text--secondary" style={{ "font-size": "var(--ff-text-body)" }}>Secondary text</p>
          <p class="ff-text--tertiary" style={{ "font-size": "var(--ff-text-body)" }}>Tertiary text</p>
          <p class="ff-text--disabled" style={{ "font-size": "var(--ff-text-body)", color: "var(--ff-text-disabled)" }}>Disabled text</p>
          <p class="ff-mono">00:00:00.000 · mono</p>
        </div>
      </Section>

      <Section title="Spacing scale">
        <div class="ff-row" style={{ "align-items": "flex-end", "--ff-row-gap": "var(--ff-space-3)" }}>
          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
            <div class="ff-stack" style={{ "align-items": "center", "--ff-stack-gap": "var(--ff-space-1)" }}>
              <div style={{ width: `var(--ff-space-${n})`, height: "16px", "background-color": "var(--ff-accent)", "border-radius": "var(--ff-radius-sm)" }} />
              <span class="ff-mono">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Color tokens">
        <div class="ff-stack" style={{ "--ff-stack-gap": "var(--ff-space-2)" }}>
          <Swatch var="--ff-bg" />
          <Swatch var="--ff-surface" />
          <Swatch var="--ff-surface-raised" />
          <Swatch var="--ff-surface-overlay" />
          <Swatch var="--ff-text" />
          <Swatch var="--ff-text-secondary" />
          <Swatch var="--ff-text-tertiary" />
          <Swatch var="--ff-text-disabled" />
          <Swatch var="--ff-border" />
          <Swatch var="--ff-border-strong" />
          <Swatch var="--ff-accent" />
          <Swatch var="--ff-accent-hover" />
          <Swatch var="--ff-accent-press" />
          <Swatch var="--ff-success" />
          <Swatch var="--ff-danger" />
          <Swatch var="--ff-range-fill" />
          <Swatch var="--ff-range-handle" />
        </div>
      </Section>
    </main>
  );
}

function Section(props: { title: string; children: any }) {
  return (
    <section class="ff-stack" style={{ "--ff-stack-gap": "var(--ff-space-3)" }}>
      <h2 style={{ "font-size": "var(--ff-text-headline)", "font-weight": "var(--ff-weight-medium)" }}>
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function Row(props: { label: string; children: any }) {
  return (
    <div class="ff-row" style={{ "align-items": "center", "--ff-row-gap": "var(--ff-space-3)" }}>
      <span class="ff-mono" style={{ width: "32px" }}>{props.label}</span>
      <div class="ff-row" style={{ "flex-wrap": "wrap", "--ff-row-gap": "var(--ff-space-2)" }}>
        {props.children}
      </div>
    </div>
  );
}

function Label(props: { children: any }) {
  return <p class="ff-mono ff-text--tertiary" style={{ "margin-bottom": "var(--ff-space-1)" }}>{props.children}</p>;
}

function Swatch(props: { var: string }) {
  return (
    <div class="ff-row" style={{ "--ff-row-gap": "var(--ff-space-2)" }}>
      <div style={{ width: "60px", height: "24px", "background-color": `var(${props.var})`, "border-radius": "var(--ff-radius-sm)", border: "1px solid var(--ff-border)" }} />
      <span class="ff-mono">{props.var}</span>
    </div>
  );
}
