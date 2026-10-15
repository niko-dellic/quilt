import { three } from './three.js';
import { defaultTheme } from './theme.js';
import { renderIcon } from './icons.js';
import 'quilt-vanilla/styles.css';
import { Workspace, defaultShortcuts } from 'quilt-vanilla';
import { initial, bindWorkspace, getPaneState, tabs, workspaceSession } from './model.js';
import { renderers } from './views.js';
import { setupShell } from './shell.js';
const layout = new Workspace<unknown>({
  container: document.querySelector('#workspace')!,
  initialLayout: initial,
  renderers: { ...renderers, canvas: three, three },
  getPaneState,
  tabs,
  theme: defaultTheme,
  resizeMode: 'border',
  renderIcon,
  shortcuts: defaultShortcuts,
  tabBar: { attachment: 'floating', fit: 'fit' },
});
bindWorkspace(layout);
setupShell(() => layout);
window.addEventListener('pagehide', () => layout.dispose(), { once: true });

const requestedWorkspace = new URLSearchParams(location.search).get('workspace');
if (
  requestedWorkspace === 'three' ||
  requestedWorkspace === 'custom' ||
  requestedWorkspace === 'adaptive'
)
  workspaceSession.select(requestedWorkspace);
