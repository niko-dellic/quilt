import { defaultTheme } from './theme.js';
import { renderIcon } from './icons.js';
import 'quilt-vanilla/styles.css';
import { Workspace } from 'quilt-vanilla';
import { initial, bindWorkspace, getPaneState, tabs } from './model.js';
import { renderers } from './views.js';
import { setupShell } from './shell.js';
const layout = new Workspace<unknown>({
  container: document.querySelector('#workspace')!,
  initialLayout: initial,
  renderers,
  getPaneState,
  tabs,
  theme: defaultTheme,
  renderIcon,
  shortcuts: true,
  tabBar: { attachment: 'floating', fit: 'fit' },
});
bindWorkspace(layout);
setupShell(() => layout);
window.addEventListener('pagehide', () => layout.dispose(), { once: true });
