<template>
  <section class="landing" aria-label="Quilt introduction">
    <div class="landing-copy">
      <p class="eyebrow">TYPESCRIPT LAYOUT LIBRARY</p>
      <h1>Workspace layouts</h1>
      <p class="landing-lead">
        Quilt is a TypeScript library for split panes, tab groups, and popout windows. It provides a
        framework-independent layout model, a DOM renderer, and React bindings.
      </p>
      <div class="landing-links">
        <a href="/vanilla.html">Vanilla TS demo <span>↗</span></a
        ><a href="/react.html">React demo <span>↗</span></a
        ><a href="/electron.html">Desktop demo <span>↗</span></a>
      </div>
    </div>
    <div class="diagram" aria-label="Nested panes with a fixed bar">
      <div class="diagram-bar">WORKSPACE</div>
      <div class="diagram-tools">Tools</div>
      <div class="diagram-canvas">Canvas<span>PANE CONTENT</span></div>
      <div class="diagram-inspector">Inspector ↗</div>
      <div class="diagram-bottom">Timeline</div>
    </div>
    <footer class="landing-footer">
      <span>Framework-independent core</span><span>JSON configuration</span
      ><span>MIT licensed</span>
    </footer>
  </section>
</template>

<style scoped>
.landing {
  max-width: 1100px;
  margin: 70px auto;
  padding: 0 30px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 410px);
  column-gap: 48px;
  row-gap: 48px;
  align-items: center;
}
.landing-copy {
  min-width: 0;
}
.landing h1 {
  font-size: clamp(40px, 5vw, 64px);
  line-height: 1.02;
  letter-spacing: -4px;
  margin: 20px 0 25px;
}
.landing-lead {
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.9;
}
.landing-links {
  display: flex;
  gap: 12px;
  margin: 28px 0 0;
  flex-wrap: wrap;
}
.landing-links a {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 13px 16px;
  font-size: 12px;
}
.landing-links span {
  padding-left: 25px;
}
.diagram {
  width: 100%;
  height: 320px;
  display: grid;
  grid-template-columns: 85px 1fr 90px;
  grid-template-rows: 32px 1fr 60px;
  gap: 5px;
  padding: 5px;
  background: var(--vp-c-divider);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  transform: rotate(-3deg);
  box-shadow: 18px 20px 0 var(--vp-c-bg-soft);
  overflow: hidden;
  font-size: 10px;
  color: var(--vp-c-text-2);
}
.diagram > div {
  padding: 12px;
  background: var(--vp-c-bg-alt);
  border-radius: 2px;
}
.diagram .diagram-bar {
  grid-column: 1/4;
  font:
    8px ui-monospace,
    monospace;
  padding: 9px;
}
.diagram .diagram-canvas {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 17px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.diagram-canvas span {
  font:
    6px ui-monospace,
    monospace;
  margin-top: 14px;
  letter-spacing: 1px;
}
.diagram-bottom {
  grid-column: 1/4;
}
.landing-footer {
  grid-column: 1 / -1;
  display: flex;
  gap: 40px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 22px;
  font:
    10px ui-monospace,
    monospace;
  color: var(--vp-c-text-2);
}

.eyebrow {
  color: var(--vp-c-text-2);
  font:
    11px ui-monospace,
    monospace;
  letter-spacing: 1.5px;
}
.landing-links a:hover {
  border-color: var(--vp-c-text-1);
}
.landing-links a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
@media (max-width: 950px) {
  .landing {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 28px;
    margin: 40px auto;
  }
  .diagram {
    transform: none;
    box-shadow: none;
  }
  .landing h1 {
    font-size: clamp(40px, 8vw, 55px);
    letter-spacing: -2px;
  }
  .landing-footer {
    flex-wrap: wrap;
    gap: 20px;
  }
}
</style>
