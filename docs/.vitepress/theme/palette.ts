import { themeFamilies } from 'quilt-vanilla';

// Adapt Quilt's public neutral preset to VitePress at build time. Keeping the
// values here derived from the preset prevents the website palettes drifting.
export const neutralPaletteCss = Object.entries(themeFamilies.neutral)
  .map(([mode, theme]) => {
    const tokens = {
      'c-bg': theme.panel,
      'c-bg-alt': theme.bg,
      'c-bg-elv': theme.header,
      'c-bg-soft': theme.header,
      'c-text-1': theme.text,
      'c-text-2': theme.muted,
      'c-text-3': theme.muted,
      'c-border': theme.line,
      'c-divider': theme.line,
      'c-gutter': theme.bg,
      'c-gray-1': theme.line,
      'c-gray-2': theme.header,
      'c-gray-3': theme.header,
      'c-gray-soft': `color-mix(in srgb, ${theme.muted} 14%, transparent)`,
      'c-brand-1': theme.accent,
      'c-brand-2': theme.text,
      'c-brand-3': theme.accent,
      'c-brand-soft': `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
      'code-block-bg': theme.bg,
      'button-brand-text': theme.panel,
      'button-brand-hover-text': theme.panel,
      'button-brand-active-text': theme.panel,
    };
    const selector = mode === 'dark' ? 'html:root.dark' : 'html:root:not(.dark)';
    return `${selector} { ${Object.entries(tokens)
      .map(([name, value]) => `--vp-${name}: ${value};`)
      .join(' ')} }`;
  })
  .join('\n');
