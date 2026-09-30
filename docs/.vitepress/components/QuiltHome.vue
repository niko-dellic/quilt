<script setup lang="ts">
import { ref } from 'vue';
import '../../../demos/site-landing.css';

const installs = [
  { label: 'Vanilla TS', command: 'npm install quilt-vanilla' },
  { label: 'React', command: 'npm install quilt-react' },
];
const selectedInstall = ref(0);
const copied = ref('');
const copyError = ref('');

function selectInstall(index: number) {
  selectedInstall.value = index;
  copied.value = '';
  copyError.value = '';
}

function navigateInstall(event: KeyboardEvent, index: number) {
  let next: number;
  switch (event.key) {
    case 'ArrowRight':
      next = (index + 1) % installs.length;
      break;
    case 'ArrowLeft':
      next = (index + installs.length - 1) % installs.length;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = installs.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  selectInstall(next);
  const tab = event.currentTarget as HTMLButtonElement;
  tab.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

async function copyInstall(command: string) {
  copied.value = '';
  copyError.value = '';
  try {
    await navigator.clipboard.writeText(command);
    if (installs[selectedInstall.value]?.command === command) copied.value = command;
  } catch {
    if (installs[selectedInstall.value]?.command === command)
      copyError.value = 'Could not copy. Select the command and copy it manually.';
  }
}
</script>

<template>
  <section class="landing site-landing" aria-label="Quilt introduction">
    <div class="landing-copy">
      <p class="eyebrow">TYPESCRIPT LAYOUT LIBRARY</p>
      <h1>Workspace layouts</h1>
      <p class="landing-lead">
        Quilt is a TypeScript library for split panes, tab groups, and popout windows. It provides a
        framework-independent layout model, a DOM renderer, and React bindings.
      </p>
      <div class="landing-links">
        <a href="/vanilla" target="_self">Vanilla TS demo <span>↗</span></a
        ><a href="/react" target="_self">React demo <span>↗</span></a
        ><a href="/electron" target="_self">Desktop demo <span>↗</span></a>
      </div>
      <div class="landing-install" aria-label="Install Quilt">
        <h2>Install Quilt</h2>
        <div class="install-tabs" role="tablist" aria-label="Framework">
          <button
            v-for="(install, index) in installs"
            :id="`install-tab-${index}`"
            :key="install.command"
            type="button"
            role="tab"
            :aria-selected="selectedInstall === index"
            :aria-controls="`install-panel-${index}`"
            :tabindex="selectedInstall === index ? 0 : -1"
            @click="selectInstall(index)"
            @keydown="navigateInstall($event, index)"
          >
            {{ install.label }}
          </button>
        </div>
        <div
          v-for="(install, index) in installs"
          v-show="selectedInstall === index"
          :id="`install-panel-${index}`"
          :key="install.command"
          role="tabpanel"
          :aria-labelledby="`install-tab-${index}`"
          tabindex="0"
          class="install-command"
        >
          <pre><code>{{ install.command }}</code></pre>
          <button
            type="button"
            :aria-label="`Copy ${install.label} install command`"
            :title="copied === install.command ? 'Copied!' : 'Copy command'"
            @click="copyInstall(install.command)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path v-if="copied === install.command" d="m5 12 4 4L19 6" />
              <template v-else>
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" />
              </template>
            </svg>
          </button>
        </div>
        <p class="copy-status" role="status">
          {{ copyError || (copied ? `Copied: ${copied}` : '') }}
        </p>
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 410px);
  column-gap: 48px;
  row-gap: 48px;
  align-items: center;
}
.landing-copy {
  min-width: 0;
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
.landing-install {
  margin-top: 28px;
}
.landing-install h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}
.install-tabs {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.install-tabs button {
  padding: 6px 0 8px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}
.install-tabs button:hover {
  color: var(--vp-c-text-1);
}
.install-tabs button[aria-selected='true'] {
  border-bottom-color: var(--vp-c-text-1);
  color: var(--vp-c-text-1);
}
.install-command {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}
.install-command pre {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow-x: auto;
  font-size: 13px;
}
.install-command button {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  font-size: 12px;
  cursor: pointer;
}
.install-command button:hover {
  border-color: var(--vp-c-text-1);
}
.install-tabs button:focus-visible,
.install-command:focus-visible,
.install-command button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
.copy-status {
  min-height: 20px;
  margin-top: 6px;
  color: var(--vp-c-text-2);
  font-size: 12px;
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
  }
  .diagram {
    transform: none;
    box-shadow: none;
  }
  .landing-footer {
    flex-wrap: wrap;
    gap: 20px;
  }
}
</style>
